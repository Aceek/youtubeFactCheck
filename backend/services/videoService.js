const { PrismaClient } = require('@prisma/client');
const { YoutubeTranscript } = require('youtube-transcript');

const prisma = new PrismaClient();

// Fonction utilitaire pour extraire l'ID de la vidéo, c'est plus robuste.
function extractVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

/**
 * Lance le processus d'analyse d'une vidéo.
 * Si la vidéo n'existe pas, elle est créée.
 * Crée une nouvelle entrée Analysis et lance la transcription.
 * @param {string} youtubeUrl - L'URL de la vidéo YouTube.
 * @param {string} transcriptionProvider - 'YOUTUBE' ou 'AI'.
 * @returns {Promise<Object>} L'objet Analysis créé.
 */
async function startAnalysis(youtubeUrl, transcriptionProvider) {
  console.log(`Début de l'analyse pour l'URL: ${youtubeUrl} avec le fournisseur: ${transcriptionProvider}`);
  
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  // 1. Trouver ou créer la vidéo parente
  const video = await prisma.video.upsert({
    where: { id: videoId },
    update: {},
    create: { id: videoId, youtubeUrl },
  });

  // 2. Créer une nouvelle entrée d'analyse en état PENDING
  const analysis = await prisma.analysis.create({
    data: {
      videoId: video.id,
      status: 'TRANSCRIBING', // On passe directement à la transcription
    },
  });

  // 3. Effectuer la transcription en fonction du choix
  try {
    let transcriptData;
    if (transcriptionProvider === 'YOUTUBE') {
      transcriptData = await getYouTubeTranscript(videoId);
    } else if (transcriptionProvider === 'AI') {
      // Logique pour AssemblyAI ou autre à implémenter ici
      console.warn("La transcription par IA n'est pas encore implémentée.");
      throw new Error("AI transcription is not available yet.");
    } else {
      throw new Error("Invalid transcription provider.");
    }

    // 4. Sauvegarder la transcription et mettre à jour l'analyse
    await prisma.transcription.create({
      data: {
        analysisId: analysis.id,
        provider: transcriptionProvider,
        content: transcriptData.structured, // JSON structuré
        fullText: transcriptData.fullText, // Texte brut
      },
    });

    const updatedAnalysis = await prisma.analysis.update({
      where: { id: analysis.id },
      data: { status: 'EXTRACTING_CLAIMS' }, // Prochaine étape logique
      include: { transcription: true } // Renvoyer la transcription avec l'analyse
    });
    
    console.log(`Transcription réussie pour l'analyse ${analysis.id}`);
    return updatedAnalysis;

  } catch (error) {
    // En cas d'échec, marquer l'analyse comme FAILED
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: { status: 'FAILED' },
    });
    console.error(`Échec de la transcription pour l'analyse ${analysis.id}:`, error);
    throw error; // Renvoyer l'erreur au contrôleur
  }
}

/**
 * Récupère et formate la transcription depuis YouTube de manière robuste.
 * Tente de récupérer la transcription dans plusieurs langues avant d'échouer.
 * @param {string} videoId - L'ID de la vidéo YouTube.
 * @returns {Promise<{structured: Array, fullText: string}>}
 */
async function getYouTubeTranscript(videoId) {
  const languagesToTry = ['fr', 'en'];
  let transcript;
  let lastError = null;

  for (const lang of languagesToTry) {
    try {
      console.log(`Tentative de récupération de la transcription en '${lang}'...`);
      transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      if (transcript && transcript.length > 0) {
        console.log(`Transcription trouvée avec succès en '${lang}' !`);
        lastError = null; // Réinitialiser l'erreur si on a réussi
        break;
      }
    } catch (error) {
      lastError = error; // Garder la dernière erreur
      console.log(`Pas de transcription trouvée en '${lang}'.`);
    }
  }

  // Tentative finale sans spécifier de langue
  if (!transcript || transcript.length === 0) {
    try {
      console.log("Tentative de récupération avec les paramètres par défaut...");
      transcript = await YoutubeTranscript.fetchTranscript(videoId);
      if (transcript && transcript.length > 0) {
          lastError = null;
          console.log("Transcription trouvée avec les paramètres par défaut.");
      }
    } catch (error) {
        lastError = error;
    }
  }

  // Si on n'a toujours rien, on analyse la dernière erreur pour donner un meilleur feedback
  if (!transcript || transcript.length === 0) {
    if (lastError && lastError.message.includes('subtitles are disabled')) {
        throw new Error('Les sous-titres sont désactivés pour cette vidéo.');
    }
    // C'est ici que nous gérons le cas le plus probable
    throw new Error(
      "Aucune transcription n'a pu être récupérée. Cela peut arriver si les sous-titres n'existent pas ou si YouTube a temporairement limité l'accès depuis notre serveur."
    );
  }

  return {
    structured: transcript,
    fullText: transcript.map(item => item.text).join(' '),
  };
}


module.exports = { startAnalysis };