const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const { spawn } = require("child_process");
const claimExtractionService = require("./claimExtractionService");

const prisma = new PrismaClient();

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

  return new Promise((resolve, reject) => {
    console.log(`1/3 - Lancement de yt-dlp pour l'URL: ${youtubeUrl}`);
    const ytDlpProcess = spawn("yt-dlp", [
      "-f",
      "bestaudio",
      "-x",
      "--audio-format",
      "mp3",
      "-o",
      "-",
      youtubeUrl,
    ]);

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

            resolve({
              fullText: getResponse.data.text,
              structured: getResponse.data.words,
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
  return {
    fullText: mockData.fullText,
    structured: mockData.content,
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
  console.log(
    `Début de l'analyse pour l'URL: ${youtubeUrl} avec le fournisseur: ${transcriptionProvider}`
  );
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error("URL YouTube invalide.");

  if (transcriptionProvider !== "MOCK_PROVIDER") {
    /**
     * CORRECTION : On inclut aussi `claims` dans le cache.
     */
    const existingAnalysis = await prisma.analysis.findFirst({
      where: { videoId: videoId, status: "COMPLETE" },
      include: {
        transcription: true,
        claims: true, // <-- AJOUT CRUCIAL
      },
    });
    if (existingAnalysis) {
      console.log(
        `Cache HIT: Analyse complète trouvée (ID: ${existingAnalysis.id}). Renvoi du résultat existant.`
      );
      return existingAnalysis;
    }
  } else {
    console.log(
      "MOCK_PROVIDER sélectionné, le cache est intentionnellement ignoré pour faciliter les tests."
    );
  }

  console.log(`Cache MISS ou ignoré: Lancement d'un nouveau processus.`);

  const video = await prisma.video.upsert({
    where: { id: videoId },
    update: {},
    create: { id: videoId, youtubeUrl },
  });

  const analysis = await prisma.analysis.create({
    data: { videoId: video.id, status: "PENDING" },
  });

  runTranscriptionProcess(analysis.id, youtubeUrl, transcriptionProvider);
  return analysis;
}

async function runTranscriptionProcess(analysisId, youtubeUrl, provider) {
  try {
    // 1. Transcription
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "TRANSCRIBING" },
    });
    const transcriptData = await getTranscriptFromProvider(
      provider,
      youtubeUrl
    );
    const transcription = await prisma.transcription.create({
      data: {
        analysisId: analysisId,
        provider: provider,
        content: transcriptData.structured,
        fullText: transcriptData.fullText,
      },
    });

    // 2. Extraction des faits (AVEC ROUTEUR DE MOCK)
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "EXTRACTING_CLAIMS" },
    });

    let claimsText;
    if (provider === "MOCK_PROVIDER") {
      claimsText = await claimExtractionService.mockExtractClaimsFromText();
    } else {
      claimsText = await claimExtractionService.extractClaimsFromText(
        transcription.fullText
      );
    }

    console.log(
      `${claimsText.length} affirmations extraites. Sauvegarde en cours...`
    );
    if (claimsText.length > 0) {
      await prisma.claim.createMany({
        data: claimsText.map((claimText) => ({
          analysisId: analysisId,
          text: claimText,
          timestamp: 0, // TODO: Approximer l'horodatage
        })),
      });
    }

    // 3. Terminé
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "COMPLETE" },
    });
    console.log(`Analyse ${analysisId} terminée avec succès.`);
  } catch (error) {
    console.error(
      `Échec du processus pour l'analyse ${analysisId}:`,
      error.message
    );
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "FAILED" },
    });
  }
}

module.exports = { startAnalysis, getAnalysisById };
