const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const { spawn } = require("child_process");
const claimExtractionService = require("./claimExtractionService");
const claimValidationService = require("./claimValidationService"); // <-- NOUVEL IMPORT
const fs = require('fs');
const path = require('path');

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

// --- NOUVELLE FONCTION UTILITAIRE ---
async function getVideoMetadata(youtubeUrl) {
    return new Promise((resolve, reject) => {
        console.log("Récupération des métadonnées de la vidéo...");
        const ytDlpProcess = spawn('yt-dlp', ['--dump-json', '-o', '-', youtubeUrl]);

        let outputData = ""; // Va collecter les données de stdout ET stderr
        let errorMessages = ""; // Va collecter les messages d'erreur purs

        // On écoute sur les deux canaux
        ytDlpProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });
        ytDlpProcess.stderr.on('data', (data) => {
            // On considère que stderr peut contenir soit le JSON, soit des erreurs.
            outputData += data.toString();
            errorMessages += data.toString();
        });

        ytDlpProcess.on('close', (code) => {
            const debugDir = path.resolve('./results');
            fs.mkdirSync(debugDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const videoId = extractVideoId(youtubeUrl) || 'unknown';
            const metadataFilePath = path.join(debugDir, `${videoId}_${timestamp}_metadata-output.txt`);
            
            // On écrit la sortie combinée pour le débogage
            fs.writeFileSync(metadataFilePath, `--- COMBINED OUTPUT ---\n${outputData}\n\n--- RAW STDERR ---\n${errorMessages}`);
            console.log(`Sortie brute des métadonnées sauvegardée dans : ${metadataFilePath}`);

            if (!outputData.trim()) {
                // Si les deux canaux sont vides, on rejette.
                return reject(new Error("Aucune donnée (stdout/stderr) reçue de yt-dlp pour les métadonnées."));
            }

            try {
                const jsonLines = outputData.trim().split('\n');
                let metadata = null;

                for (const line of jsonLines) {
                    try {
                        const parsedLine = JSON.parse(line);
                        if (typeof parsedLine === 'object' && parsedLine.title) {
                            metadata = parsedLine;
                            break;
                        }
                    } catch (lineError) {
                        continue;
                    }
                }

                if (!metadata) {
                    // Cette erreur est maintenant plus pertinente: le JSON était présent mais invalide ou incomplet.
                    throw new Error("Impossible de trouver un objet JSON de métadonnées valide dans la sortie de yt-dlp.");
                }

                resolve({
                    title: metadata.title,
                    author: metadata.uploader || metadata.channel,
                    description: metadata.description,
                    publishedAt: metadata.upload_date ? new Date(metadata.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) : null,
                    thumbnailUrl: metadata.thumbnail
                });
            } catch (error) {
                // Si le code n'est pas 0 ET qu'on n'a pas pu parser, c'est une vraie erreur.
                if (code !== 0) {
                     return reject(new Error(`yt-dlp a quitté avec le code ${code}. Erreur: ${errorMessages}`));
                }
                // Sinon, c'est juste un problème de parsing de la sortie.
                reject(new Error(`Erreur de parsing des métadonnées JSON : ${error.message}`));
            }
        });
    });
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
      claims: {
              orderBy: { timestamp: 'asc' } // <-- TRI AJOUTÉ ICI
            },
      video: true,
    },
  });
}

// Passez le paramètre 'withValidation' à travers les fonctions
async function startAnalysis(youtubeUrl, transcriptionProvider, withValidation) {
  console.log(`Début de l'analyse pour l'URL: ${youtubeUrl} avec le fournisseur: ${transcriptionProvider}, validation: ${withValidation}`);
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error('URL YouTube invalide.');

  const currentLlmModel = process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct:free";

  // --- CORRECTION MAJEURE : SÉPARATION DES LOGIQUES MOCK ET RÉELLE ---
  if (transcriptionProvider === 'MOCK_PROVIDER') {
    // ---- LOGIQUE POUR LE MOCK ----
    console.log('MOCK_PROVIDER sélectionné. Lancement d\'un processus complet simulé.');
    
    const video = await prisma.video.upsert({
      where: { id: videoId },
      update: {},
      create: { id: videoId, youtubeUrl },
    });
    const analysis = await prisma.analysis.create({
      data: { videoId: video.id, status: 'PENDING' },
    });
    
    // On lance le processus complet, mais la fonction getTranscriptFromProvider
    // saura qu'elle doit utiliser la version simulée.
    runFullProcess(analysis.id, youtubeUrl, transcriptionProvider, withValidation); // <-- PASSER withValidation
    
    const initialAnalysisWithVideo = { ...analysis, video: video };
    return { analysis: initialAnalysisWithVideo, fromCache: false };

  } else {
    // ---- LOGIQUE POUR L'ANALYSE RÉELLE (ASSEMBLY_AI) ----

    // 1. On cherche la dernière analyse RÉELLE complète (on ignore les mocks).
    const lastAnalysis = await prisma.analysis.findFirst({
      where: {
        videoId: videoId,
        status: 'COMPLETE',
        llmModel: { not: 'MOCK_PROVIDER' } // <-- Condition clé pour ignorer les mocks
      },
      orderBy: { createdAt: 'desc' },
      include: {
        transcription: true,
        claims: {
          orderBy: { timestamp: 'asc' } // <-- TRI AJOUTÉ ICI
        },
        video: true
      },
    });

    if (lastAnalysis) {
      // 2. Si on trouve une analyse réelle, on vérifie le modèle LLM.
      if (lastAnalysis.llmModel === currentLlmModel) {
        console.log(`Cache HIT: Analyse réelle complète trouvée (ID: ${lastAnalysis.id}).`);
        // Si on a trouvé une analyse en cache, on ne relance pas la validation ici.
        // La validation sera lancée si l'utilisateur clique sur le bouton de re-validation.
        return { analysis: lastAnalysis, fromCache: true };
      }
      
      // 3. Le modèle a changé, on lance une RE-ANALYSE basée sur la transcription réelle.
      console.log(`RE-ANALYSE: Le modèle LLM a changé de "${lastAnalysis.llmModel}" à "${currentLlmModel}".`);
      const newAnalysis = await prisma.analysis.create({
        data: { videoId: videoId, status: 'PENDING' },
      });
      
      // Lors d'une ré-analyse due au changement de modèle, on lance toujours la validation
      runClaimExtractionProcess(newAnalysis.id, lastAnalysis.transcription, transcriptionProvider, true); // <-- PASSER true pour withValidation
      
      const newAnalysisWithVideo = { ...newAnalysis, video: lastAnalysis.video };
      return { analysis: newAnalysisWithVideo, fromCache: false };
    }

    // 4. Si aucune analyse réelle n'est trouvée, on lance un nouveau processus complet.
    console.log(`Cache MISS: Lancement d'un nouveau processus réel complet.`);
    const video = await prisma.video.upsert({
      where: { id: videoId },
      update: {},
      create: { id: videoId, youtubeUrl },
    });
    const analysis = await prisma.analysis.create({
      data: { videoId: video.id, status: 'PENDING' },
    });
    
    runFullProcess(analysis.id, youtubeUrl, transcriptionProvider, withValidation); // <-- PASSER withValidation
    
    const initialAnalysisWithVideo = { ...analysis, video: video };
    return { analysis: initialAnalysisWithVideo, fromCache: false };
  }
}

/**
 * Processus complet : Transcription PUIS Extraction.
 */
/**
 * Processus complet : Métadonnées -> Transcription -> Extraction.
 * Gère les erreurs de manière plus granulaire.
 */
/**
 * Processus complet : Métadonnées -> Transcription -> Extraction -> Validation (conditionnelle).
 * Gère les erreurs de manière plus granulaire.
 */
async function runFullProcess(analysisId, youtubeUrl, provider, withValidation) { // <-- AJOUT du paramètre withValidation
    // --- ÉTAPE 1: RÉCUPÉRATION DES MÉTADONNÉES (NON-BLOQUANTE) ---
    try {
        await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'FETCHING_METADATA' } });
        
        const metadata = await getVideoMetadata(youtubeUrl);
        const videoId = extractVideoId(youtubeUrl);
        await prisma.video.update({
            where: { id: videoId },
            data: {
                title: metadata.title,
                author: metadata.author,
                description: metadata.description,
                publishedAt: metadata.publishedAt,
                thumbnailUrl: metadata.thumbnailUrl,
            }
        });
        console.log("✅ Métadonnées récupérées avec succès.");

    } catch (error) {
        console.warn(`⚠️ Échec de la récupération des métadonnées (non-bloquant) : ${error.message}`);
        // On enregistre l'erreur dans l'analyse mais on continue le processus.
        await prisma.analysis.update({
            where: { id: analysisId },
            data: { errorMessage: `Échec de la récupération des métadonnées : ${error.message}` }
        });
    }

    // --- ÉTAPE 2: TRANSCRIPTION (BLOQUANTE) ---
    try {
        await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'TRANSCRIBING' } });
        const transcriptData = await getTranscriptFromProvider(provider, youtubeUrl);
        const transcription = await prisma.transcription.create({
            data: {
                analysisId: analysisId,
                provider: provider,
                content: transcriptData,
                fullText: transcriptData.fullText,
            }
        });

        // --- ÉTAPE 3: EXTRACTION ET VALIDATION DES CLAIMS (BLOQUANTE) ---
        // Le reste du processus est lancé depuis ici
        await runClaimExtractionProcess(analysisId, transcription, provider, withValidation); // <-- PASSER withValidation

    } catch (criticalError) {
        // Si la transcription ou l'extraction échoue, c'est une erreur critique.
        console.error(`Échec critique du processus pour l'analyse ${analysisId}:`, criticalError.message);
        await prisma.analysis.update({
            where: { id: analysisId },
            data: { status: 'FAILED', errorMessage: `Erreur critique : ${criticalError.message}` }
        });
    }
}

/**
 * Processus partiel : Uniquement l'Extraction des Faits (pour la ré-analyse).
 * @param {number} analysisId - L'ID de la NOUVELLE analyse.
 * @param {object} transcription - La transcription EXISTANTE à analyser.
 * @param {string} provider - Le fournisseur de transcription original de la requête.
 */
/**
 * Processus partiel : Uniquement l'Extraction des Faits (pour la ré-analyse).
 * @param {number} analysisId - L'ID de la NOUVELLE analyse.
 * @param {object} transcription - La transcription EXISTANTE à analyser.
 * @param {string} provider - Le fournisseur de transcription original de la requête.
 * @param {boolean} withValidation - Indique si la validation doit être exécutée après l'extraction.
 */
async function runClaimExtractionProcess(analysisId, transcription, provider, withValidation) { // <-- AJOUT du paramètre withValidation
  try {
    // MODIFICATION : Le modèle dépend maintenant du provider
    const currentLlmModel = provider === 'MOCK_PROVIDER'
      ? 'MOCK_PROVIDER'
      : process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct:free";

    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'EXTRACTING_CLAIMS' } });
    
    let claimsData;
    if (provider === 'MOCK_PROVIDER') {
      claimsData = await claimExtractionService.mockExtractClaimsFromText();
    } else {
      claimsData = await claimExtractionService.extractClaimsWithTimestamps(
        analysisId,
        transcription.content,
        currentLlmModel
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

    // --- NOUVELLE ÉTAPE : VALIDATION CONDITIONNELLE ---
    if (withValidation) {
      await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'VALIDATING_CLAIMS' } });
      const createdClaims = await prisma.claim.findMany({ where: { analysisId } });
      console.log(`Lancement de la validation pour ${createdClaims.length} affirmations...`);
      
      const validationPromises = createdClaims.map(claim =>
        claimValidationService.validateClaim(claim, transcription.content.paragraphs)
          .then(result => prisma.claim.update({
            where: { id: claim.id },
            data: {
              validationStatus: result.validationStatus,
              validationExplanation: result.explanation,
              validationScore: result.validationScore,
            }
          }))
      );
      await Promise.all(validationPromises);
      console.log("✅ Validation terminée.");
    }
    
    // On met à jour le statut final
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: 'COMPLETE', llmModel: currentLlmModel }
    });
    console.log(`Analyse ${analysisId} terminée avec succès.`);

  } catch (error) {
    console.error(`Échec du processus d'extraction ou de validation pour l'analyse ${analysisId}:`, error.message);
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
    include: {
      transcription: true,
      video: true,
      claims: {
        orderBy: { timestamp: 'asc' } // <-- TRI AJOUTÉ ICI (par cohérence)
      }
    },
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

  // On attache les métadonnées pour que l'UI se mette à jour instantanément
  const updatedAnalysisWithVideo = {
    ...updatedAnalysis,
    video: analysisToRerun.video
  };
  return updatedAnalysisWithVideo;
}

// On exporte la nouvelle fonction
module.exports = { startAnalysis, getAnalysisById, rerunClaimExtraction };
