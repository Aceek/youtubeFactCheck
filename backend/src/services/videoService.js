const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const { spawn } = require("child_process");
const claimExtractionService = require("./claimExtractionService");

const prisma = require("../client"); // Utilisation du client partagé

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const API_ENDPOINT = "https://api.assemblyai.com/v2";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractVideoId(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function getTranscriptFromAssemblyAI(youtubeUrl) {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error(
      "Clé d'API AssemblyAI (ASSEMBLYAI_API_KEY) non configurée."
    );
  }

  // --- AMÉLIORATION DE SÉCURITÉ MAJEURE ---
  // On ne fait plus confiance à l'URL brute. On la reconstruit à partir de l'ID extrait.
  // Cela élimine tout risque d'injection de commande.
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("L'ID de la vidéo n'a pas pu être extrait de l'URL fournie.");
  }
  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  return new Promise((resolve, reject) => {
    console.log(`1/3 - Lancement de yt-dlp pour l'URL sécurisée: ${cleanUrl}`);
    // On utilise l'URL nettoyée, pas l'URL de l'utilisateur.
    const ytDlpProcess = spawn('yt-dlp', ['-f', 'bestaudio', '-x', '--audio-format', 'mp3', '-o', '-', cleanUrl]);

    let stderr = "";
    ytDlpProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ytDlpProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(
          `yt-dlp a quitté avec le code ${code}. Erreur: ${stderr}`
        );
        reject(
          new Error("Le téléchargement de l'audio depuis YouTube a échoué.")
        );
      }
    });

    console.log("2/3 - Upload du flux audio vers AssemblyAI...");
    axios
      .post(`${API_ENDPOINT}/upload`, ytDlpProcess.stdout, {
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          "Transfer-Encoding": "chunked",
        },
      })
      .then((uploadResponse) => {
        const { upload_url } = uploadResponse.data;
        console.log(`Upload réussi. URL temporaire de l'audio : ${upload_url}`);

        console.log("3/3 - Soumission de l'audio pour transcription...");
        return axios.post(
          `${API_ENDPOINT}/transcript`,
          {
            audio_url: upload_url,
            language_detection: true,
          },
          {
            headers: { authorization: ASSEMBLYAI_API_KEY },
          }
        );
      })
      .then(async (submitResponse) => {
        const { id: transcriptId } = submitResponse.data;

        while (true) {
          console.log(`Vérification du statut (ID: ${transcriptId})...`);
          await sleep(5000);
          const getResponse = await axios.get(
            `${API_ENDPOINT}/transcript/${transcriptId}`,
            {
              headers: { authorization: ASSEMBLYAI_API_KEY },
            }
          );

          const { status, error } = getResponse.data;
          if (status === "completed") {
            console.log("✅ Transcription terminée !");
            
            // On récupère les paragraphes pour un meilleur contexte
            const paragraphResponse = await axios.get(
                `${API_ENDPOINT}/transcript/${transcriptId}/paragraphs`,
                { headers: { authorization: ASSEMBLYAI_API_KEY } }
            );

            resolve({
              fullText: getResponse.data.text,
              words: getResponse.data.words,
              paragraphs: paragraphResponse.data.paragraphs
            });
            return;
          } else if (status === "failed") {
            reject(
              new Error(
                `Le service de transcription a échoué. Raison: ${error}`
              )
            );
            return;
          }
        }
      })
      .catch((err) => {
        console.error(
          "Erreur dans le processus de transcription AssemblyAI:",
          err.message
        );
        reject(
          new Error(
            "Échec de la communication avec le service de transcription."
          )
        );
      });
  });
}

// Renommez la fonction de routage pour plus de clarté
async function getTranscriptFromProvider(provider, youtubeUrl) {
  if (provider === "ASSEMBLY_AI")
    return getTranscriptFromAssemblyAI(youtubeUrl);
  if (provider === "MOCK_PROVIDER") return getTranscriptFromMockProvider();
  throw new Error(`Fournisseur non supporté: "${provider}"`);
}

/**
 * NOUVELLE FONCTION : Service de transcription "Mock".
 * Simule le processus de transcription en utilisant une transcription existante.
 * @returns {Promise<{fullText: string, structured: object}>} - Les données de transcription simulées.
 */
async function getTranscriptFromMockProvider() {
  console.log("MOCK_PROVIDER: Démarrage de la transcription simulée.");

  // 1. On cherche des transcriptions existantes dans la base de données.
  const existingTranscriptions = await prisma.transcription.findMany({
    where: { fullText: { not: null } }, // On s'assure de ne prendre que des transcriptions valides
  });

  if (existingTranscriptions.length === 0) {
    console.error(
      "MOCK_PROVIDER: Aucune transcription existante à utiliser. Veuillez d'abord lancer une vraie analyse."
    );
    throw new Error(
      "Le mode de test nécessite au moins une transcription réelle dans la base de données."
    );
  }

  // 2. On en choisit une au hasard.
  const randomIndex = Math.floor(Math.random() * existingTranscriptions.length);
  const mockData = existingTranscriptions[randomIndex];
  console.log(
    `MOCK_PROVIDER: Utilisation de la transcription existante ID: ${mockData.id}`
  );

  // 3. On simule un délai pour rendre l'expérience réaliste pour le frontend.
  await sleep(3000); // Simule un délai de 3 secondes

  console.log("MOCK_PROVIDER: ✅ Transcription simulée terminée !");
  // On s'assure que mockData.content contient bien { words, paragraphs }
  return {
    fullText: mockData.fullText,
    words: mockData.content.words,
    paragraphs: mockData.content.paragraphs
  };
}

async function getAnalysisById(id) {
  return prisma.analysis.findUnique({
    where: { id },
    include: {
      transcription: true,
      claims: true,
    },
  });
}

async function startAnalysis(youtubeUrl, transcriptionProvider) {
  console.log(`Début de l'analyse pour l'URL: ${youtubeUrl} avec le fournisseur: ${transcriptionProvider}`);
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error('URL YouTube invalide.');

  // --- NOUVELLE LOGIQUE DE CACHE ET DE RE-ANALYSE ---
  // On récupère le nom du modèle LLM actuel depuis l'environnement.
  const currentLlmModel = process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct:free";

  if (transcriptionProvider !== 'MOCK_PROVIDER') {
    // On cherche la dernière analyse complète pour cette vidéo.
    const lastAnalysis = await prisma.analysis.findFirst({
      where: { videoId: videoId, status: 'COMPLETE' },
      orderBy: { createdAt: 'desc' },
      include: { transcription: true, claims: true },
    });

    if (lastAnalysis) {
      // Si le modèle utilisé est le même que le modèle actuel, on renvoie le cache.
      if (lastAnalysis.llmModel === currentLlmModel) {
        console.log(`Cache HIT: Analyse complète trouvée (ID: ${lastAnalysis.id}) avec le même LLM (${currentLlmModel}). Renvoi du résultat existant.`);
        return lastAnalysis;
      }
      
      // SINON, le modèle a changé ! On lance une RE-ANALYSE.
      console.log(`RE-ANALYSE: Le modèle LLM a changé de "${lastAnalysis.llmModel}" à "${currentLlmModel}".`);
      const newAnalysis = await prisma.analysis.create({
        data: { videoId: videoId, status: 'PENDING' },
      });
      // On lance le processus d'extraction sur la transcription existante.
      runClaimExtractionProcess(newAnalysis.id, lastAnalysis.transcription, transcriptionProvider);
      return newAnalysis;
    }
  } else {
    console.log('MOCK_PROVIDER sélectionné, le cache est ignoré.');
  }
  
  console.log(`Cache MISS ou ignoré: Lancement d'un nouveau processus complet.`);

  const video = await prisma.video.upsert({
    where: { id: videoId },
    update: {},
    create: { id: videoId, youtubeUrl },
  });
  const analysis = await prisma.analysis.create({
    data: { videoId: video.id, status: 'PENDING' },
  });
  
  // Le processus complet (transcription + extraction)
  runFullProcess(analysis.id, youtubeUrl, transcriptionProvider);
  return analysis;
}

/**
 * Processus complet : Transcription PUIS Extraction.
 */
async function runFullProcess(analysisId, youtubeUrl, provider) {
  try {
    // 1. Transcription
    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'TRANSCRIBING' } });
    const transcriptData = await getTranscriptFromProvider(provider, youtubeUrl);
    const transcription = await prisma.transcription.create({
      data: {
        analysisId: analysisId,
        provider: provider, // On utilise le provider original ici aussi
        // On sauvegarde l'objet complet {fullText, words, paragraphs} dans `content`
        content: transcriptData,
        fullText: transcriptData.fullText,
      }
    });

    await runClaimExtractionProcess(analysisId, transcription, provider);

  } catch (error) {
    console.error(`Échec du processus complet pour l'analyse ${analysisId}:`, error.message);
    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'FAILED' } });
  }
}

/**
 * Processus partiel : Uniquement l'Extraction des Faits (pour la ré-analyse).
 * @param {number} analysisId - L'ID de la NOUVELLE analyse.
 * @param {object} transcription - La transcription EXISTANTE à analyser.
 * @param {string} provider - Le fournisseur de transcription original de la requête.
 */
async function runClaimExtractionProcess(analysisId, transcription, provider) {
  try {
    const currentLlmModel = process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct:free";

    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'EXTRACTING_CLAIMS' } });
    
    let claimsData;
    if (provider === 'MOCK_PROVIDER') {
      claimsData = await claimExtractionService.mockExtractClaimsFromText();
    } else {
      // ON PASSE L'ID DE L'ANALYSE ET LE MODÈLE
      claimsData = await claimExtractionService.extractClaimsWithTimestamps(
        analysisId,
        transcription.content,
        currentLlmModel // <-- Pour le logging complet
      );
    }
    
    console.log(`${claimsData.length} affirmations extraites avec le modèle ${currentLlmModel}.`);
    if (claimsData.length > 0) {
      await prisma.claim.createMany({
        data: claimsData.map(claim => ({
          analysisId: analysisId,
          text: claim.text,
          timestamp: claim.timestamp,
        })),
      });
    }

    // TERMINÉ : On met à jour le statut ET le nom du modèle utilisé.
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'COMPLETE',
        llmModel: currentLlmModel,
      }
    });
    console.log(`Analyse ${analysisId} terminée avec succès.`);

  } catch (error) {
    console.error(`Échec du processus d'extraction pour l'analyse ${analysisId}:`, error.message);
    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'FAILED' } });
  }
}

/**
 * NOUVELLE FONCTION : Relance uniquement l'extraction des "claims".
 * @param {number} analysisId - L'ID de l'analyse à relancer.
 * @returns {object} La nouvelle analyse mise à jour.
 */
async function rerunClaimExtraction(analysisId) {
  console.log(`RE-ANALYSE manuelle des claims pour l'analyse ID: ${analysisId}`);
  
  const analysisToRerun = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: { transcription: true },
  });

  if (!analysisToRerun || !analysisToRerun.transcription) {
    throw new Error("Impossible de relancer : l'analyse ou sa transcription n'existe pas.");
  }
  
  // 1. On efface les anciens "claims" pour éviter les doublons.
  await prisma.claim.deleteMany({
    where: { analysisId: analysisId },
  });

  // 2. On met à jour le statut pour que le frontend réagisse.
  const updatedAnalysis = await prisma.analysis.update({
    where: { id: analysisId },
    data: { status: 'PENDING' } // On le repasse en 'pending' avant de lancer le processus
  });

  // 3. On lance le processus d'extraction en arrière-plan.
  // On passe le provider de la transcription existante pour que le mock fonctionne.
  runClaimExtractionProcess(analysisId, analysisToRerun.transcription, analysisToRerun.transcription.provider);

  return updatedAnalysis;
}

// On exporte la nouvelle fonction
module.exports = { startAnalysis, getAnalysisById, rerunClaimExtraction };
