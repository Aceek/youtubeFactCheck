const axios = require("axios");
const { spawn } = require("child_process");
const prisma = require("../client");

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const API_ENDPOINT = "https://api.assemblyai.com/v2";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extrait l'ID de la vidéo depuis une URL YouTube
 * @param {string} url - L'URL YouTube
 * @returns {string|null} L'ID de la vidéo ou null si non trouvé
 */
function extractVideoId(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

/**
 * Obtient la transcription depuis AssemblyAI
 * @param {string} youtubeUrl - L'URL de la vidéo YouTube
 * @returns {Promise<Object>} La transcription structurée
 */
async function getTranscriptFromAssemblyAI(youtubeUrl) {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error(
      "Clé d'API AssemblyAI (ASSEMBLYAI_API_KEY) non configurée."
    );
  }
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("L'ID de la vidéo n'a pas pu être extrait de l'URL fournie.");
  }
  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  return new Promise((resolve, reject) => {
    console.log(`1/3 - Lancement de yt-dlp pour l'URL sécurisée: ${cleanUrl}`);
    const ytDlpProcess = spawn('yt-dlp', ['-f', 'bestaudio', '-x', '--audio-format', 'mp3', '-o', '-', cleanUrl]);

    let stderr = "";
    ytDlpProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ytDlpProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`yt-dlp a quitté avec le code ${code}. Erreur: ${stderr}`);
        reject(new Error("Le téléchargement de l'audio depuis YouTube a échoué."));
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
        return axios.post(`${API_ENDPOINT}/transcript`, { audio_url: upload_url, language_detection: true }, { headers: { authorization: ASSEMBLYAI_API_KEY } });
      })
      .then(async (submitResponse) => {
        const { id: transcriptId } = submitResponse.data;
        while (true) {
          console.log(`Vérification du statut (ID: ${transcriptId})...`);
          await sleep(5000);
          const getResponse = await axios.get(`${API_ENDPOINT}/transcript/${transcriptId}`, { headers: { authorization: ASSEMBLYAI_API_KEY } });
          const { status, error } = getResponse.data;
          if (status === "completed") {
            console.log("✅ Transcription terminée !");
            const paragraphResponse = await axios.get(`${API_ENDPOINT}/transcript/${transcriptId}/paragraphs`, { headers: { authorization: ASSEMBLYAI_API_KEY } });
            resolve({
              fullText: getResponse.data.text,
              words: getResponse.data.words,
              paragraphs: paragraphResponse.data.paragraphs
            });
            return;
          } else if (status === "failed") {
            reject(new Error(`Le service de transcription a échoué. Raison: ${error}`));
            return;
          }
        }
      })
      .catch((err) => {
        console.error("Erreur dans le processus de transcription AssemblyAI:", err.message);
        reject(new Error("Échec de la communication avec le service de transcription."));
      });
  });
}

/**
 * Obtient une transcription simulée depuis la base de données
 * @returns {Promise<Object>} Une transcription simulée
 */
async function getTranscriptFromMockProvider() {
  console.log("MOCK_PROVIDER: Démarrage de la transcription simulée.");
  const existingTranscriptions = await prisma.transcription.findMany({
    where: { fullText: { not: null } },
  });

  if (existingTranscriptions.length === 0) {
    console.error("MOCK_PROVIDER: Aucune transcription existante à utiliser. Veuillez d'abord lancer une vraie analyse.");
    throw new Error("Le mode de test nécessite au moins une transcription réelle dans la base de données.");
  }

  const randomIndex = Math.floor(Math.random() * existingTranscriptions.length);
  const mockData = existingTranscriptions[randomIndex];
  console.log(`MOCK_PROVIDER: Utilisation de la transcription existante ID: ${mockData.id}`);
  await sleep(3000);
  console.log("MOCK_PROVIDER: ✅ Transcription simulée terminée !");
  return {
    fullText: mockData.fullText,
    words: mockData.content.words,
    paragraphs: mockData.content.paragraphs
  };
}

/**
 * Obtient la transcription selon le provider spécifié
 * @param {string} provider - Le provider de transcription (ASSEMBLY_AI ou MOCK_PROVIDER)
 * @param {string} youtubeUrl - L'URL de la vidéo YouTube
 * @returns {Promise<Object>} La transcription
 */
async function getTranscriptFromProvider(provider, youtubeUrl) {
  if (provider === "ASSEMBLY_AI")
    return getTranscriptFromAssemblyAI(youtubeUrl);
  if (provider === "MOCK_PROVIDER") return getTranscriptFromMockProvider();
  throw new Error(`Fournisseur non supporté: "${provider}"`);
}

module.exports = { 
  getTranscriptFromProvider,
  getTranscriptFromAssemblyAI,
  getTranscriptFromMockProvider,
  extractVideoId
};