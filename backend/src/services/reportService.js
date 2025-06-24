// backend/src/services/reportService.js

const prisma = require('../client');
const debugLogService = require('./debugLogService');

/**
 * Formate une liste de paragraphes en une seule chaîne de caractères
 * avec des balises de timestamp.
 * @param {Array} paragraphs - La liste des paragraphes de la transcription.
 * @returns {string} La transcription complète et formatée.
 */
function formatTranscriptWithTimestamps(paragraphs) {
  if (!paragraphs || paragraphs.length === 0) {
    return "Aucun paragraphe à formater.";
  }
  
  return paragraphs.map(para => {
    const timestamp = Math.round(para.start / 1000);
    // Format [t=XXX] - [HH:MM:SS] Texte du paragraphe
    const hours = Math.floor(timestamp / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((timestamp % 3600) / 60).toString().padStart(2, '0');
    const seconds = (timestamp % 60).toString().padStart(2, '0');
    
    return `[t=${timestamp}] - [${hours}:${minutes}:${seconds}] ${para.text}`;
  }).join('\n\n');
}

/**
 * Trouve le paragraphe source d'un claim basé sur son timestamp.
 * Retourne le paragraphe lui-même et un contexte de +/- 1 paragraphe.
 * @param {object} claim - L'objet claim avec un timestamp.
 * @param {Array} paragraphs - La liste de tous les paragraphes de la transcription.
 * @returns {{sourceParagraph: object, fullContext: string}|null}
 */
function findClaimContext(claim, paragraphs) {
  if (!paragraphs || paragraphs.length === 0) return null;

  // On cherche le premier paragraphe pour lequel le timestamp du claim
  // est compris entre le début et la fin du paragraphe.
  const bestMatchIndex = paragraphs.findIndex(p => {
    const paraStartSeconds = p.start / 1000;
    const paraEndSeconds = p.end / 1000;
    return claim.timestamp >= paraStartSeconds && claim.timestamp <= paraEndSeconds;
  });

  // Si aucun paragraphe ne correspond, on utilise l'ancienne logique comme fallback.
  if (bestMatchIndex === -1) {
    let fallbackIndex = -1;
    for (let i = 0; i < paragraphs.length; i++) {
      if ((paragraphs[i].start / 1000) <= claim.timestamp) {
        fallbackIndex = i;
      } else {
        break;
      }
    }
    if (fallbackIndex === -1) return null;
    return buildContext(fallbackIndex, paragraphs); // On externalise la construction du contexte
  }
  
  return buildContext(bestMatchIndex, paragraphs); // On externalise la construction du contexte
}

// Nouvelle fonction helper pour éviter la répétition
function buildContext(index, paragraphs) {
    // On s'assure que l'index est valide
    if (index < 0 || index >= paragraphs.length) {
        return null;
    }
    
    const sourceParagraphObject = paragraphs[index];

    // On ne construit plus une fenêtre, mais on retourne uniquement le paragraphe source.
    const sourceParagraphText = `[${index}] (Source) ${sourceParagraphObject.text}`;

    return {
        sourceParagraph: {
            index: index,
            ...sourceParagraphObject
        },
        // Le nom de la clé est conservé pour ne pas casser la structure,
        // mais son contenu est maintenant beaucoup plus simple.
        fullContextText: sourceParagraphText
    };
}

/**
 * Génère un rapport final exhaustif de l'analyse, incluant le contexte des claims
 * et exporte la transcription complète.
 * @param {number} analysisId - ID de l'analyse
 * @returns {Promise<boolean>} True si le rapport est généré, false sinon.
 */
async function generateAndSaveFinalReport(analysisId) {
  console.log(`📋 Génération du rapport final pour l'analyse ${analysisId}`);
  
  try {
    const completeAnalysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        video: true,
        transcription: true,
        claims: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!completeAnalysis) {
      throw new Error(`Analyse ${analysisId} non trouvée`);
    }

    const allParagraphs = completeAnalysis.transcription?.content?.paragraphs || [];

    // MODIFICATION ICI : On vérifie qu'on a bien des paragraphes avant de formater et sauvegarder.
    if (allParagraphs.length > 0) {
        // On utilise notre nouvelle fonction pour formater le texte
        const formattedTranscript = formatTranscriptWithTimestamps(allParagraphs);
        
        debugLogService.log(
            analysisId,
            'full_transcript.txt',
            formattedTranscript // On passe le texte formaté
        );
        console.log(`[DEBUG] Transcription complète et formatée sauvegardée pour l'analyse ${analysisId}`);
    } else if (completeAnalysis.transcription?.fullText) {
        // Fallback : si on n'a pas de paragraphes mais qu'on a du texte brut, on le sauvegarde quand même.
        debugLogService.log(
            analysisId,
            'full_transcript.txt',
            completeAnalysis.transcription.fullText
        );
        console.log(`[DEBUG] Transcription complète (brute) sauvegardée pour l'analyse ${analysisId}`);
    }

    const finalReport = {
      analysis: {
        id: completeAnalysis.id,
        status: completeAnalysis.status,
        llmModel: completeAnalysis.llmModel,
        createdAt: completeAnalysis.createdAt,
        updatedAt: completeAnalysis.updatedAt,
        errorMessage: completeAnalysis.errorMessage
      },
      video: {
        id: completeAnalysis.video.id,
        youtubeUrl: completeAnalysis.video.youtubeUrl,
        title: completeAnalysis.video.title,
        author: completeAnalysis.video.author,
        description: completeAnalysis.video.description,
        publishedAt: completeAnalysis.video.publishedAt,
        thumbnailUrl: completeAnalysis.video.thumbnailUrl
      },
      transcription: {
        id: completeAnalysis.transcription?.id,
        provider: completeAnalysis.transcription?.provider,
        fullTextLength: completeAnalysis.transcription?.fullText?.length || 0,
        paragraphsCount: allParagraphs.length
      },
      claims: {
        total: completeAnalysis.claims.length,
        byStatus: completeAnalysis.claims.reduce((acc, claim) => {
          const status = claim.validationStatus || 'NOT_VALIDATED';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
        details: completeAnalysis.claims.map(claim => {
            const contextInfo = findClaimContext(claim, allParagraphs);
            return {
              id: claim.id,
              text: claim.text,
              timestamp: claim.timestamp,
              context: {
                sourceParagraphIndex: contextInfo?.sourceParagraph?.index ?? null,
                // On s'assure que la clé utilisée ici (`fullContextText`)
                // correspond à celle retournée par `buildContext`.
                fullContextText: contextInfo?.fullContextText ?? "Contexte introuvable."
              },
              validationStatus: claim.validationStatus,
              validationExplanation: claim.validationExplanation,
              validationScore: claim.validationScore
            };
        })
      },
      summary: {
        extractionModel: completeAnalysis.llmModel,
        validationModel: process.env.VALIDATION_MODEL || null,
        chunkSize: parseInt(process.env.CHUNK_SIZE) || null,
        chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || null,
        reportGeneratedAt: new Date().toISOString()
      }
    };

    debugLogService.log(
      analysisId,
      'final_analysis_report.json',
      JSON.stringify(finalReport, null, 2)
    );

    console.log(`✅ Rapport final généré avec succès pour l'analyse ${analysisId}`);
    return true;

  } catch (error) {
    console.error(`❌ Erreur lors de la génération du rapport final:`, error.message);
    const errorReport = {
      analysisId: analysisId,
      error: error.message,
      reportGeneratedAt: new Date().toISOString()
    };
    debugLogService.log(
      analysisId,
      'final_analysis_report_ERROR.json',
      JSON.stringify(errorReport, null, 2)
    );
    return false;
  }
}

module.exports = { generateAndSaveFinalReport };