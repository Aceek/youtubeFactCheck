// backend/src/services/reportService.js

const prisma = require('../client');
const debugLogService = require('./debugLogService');

/**
 * Trouve le paragraphe source d'un claim basé sur son timestamp.
 * Retourne le paragraphe lui-même et un contexte de +/- 1 paragraphe.
 * @param {object} claim - L'objet claim avec un timestamp.
 * @param {Array} paragraphs - La liste de tous les paragraphes de la transcription.
 * @returns {{sourceParagraph: object, fullContext: string}|null}
 */
function findClaimContext(claim, paragraphs) {
  if (!paragraphs || paragraphs.length === 0) return null;

  let bestMatchIndex = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    const paraStartSeconds = paragraphs[i].start / 1000;
    if (paraStartSeconds <= claim.timestamp) {
      bestMatchIndex = i;
    } else {
      break;
    }
  }

  if (bestMatchIndex === -1) return null;

  const contextSlices = [];
  if (bestMatchIndex > 0) {
    contextSlices.push(`[${bestMatchIndex - 1}] ${paragraphs[bestMatchIndex - 1].text}`);
  }
  contextSlices.push(`[${bestMatchIndex}] (Source) ${paragraphs[bestMatchIndex].text}`);
  if (bestMatchIndex < paragraphs.length - 1) {
    contextSlices.push(`[${bestMatchIndex + 1}] ${paragraphs[bestMatchIndex + 1].text}`);
  }

  return {
    sourceParagraph: {
      index: bestMatchIndex,
      ...paragraphs[bestMatchIndex]
    },
    fullContext: contextSlices.join('\n\n---\n\n')
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

    if (completeAnalysis.transcription?.fullText) {
        debugLogService.log(
            analysisId,
            'full_transcript.txt',
            completeAnalysis.transcription.fullText
        );
        console.log(`[DEBUG] Transcription complète sauvegardée pour l'analyse ${analysisId}`);
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
                fullContextText: contextInfo?.fullContext ?? "Contexte introuvable."
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