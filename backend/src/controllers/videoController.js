const videoService = require('../services/videoService');

async function createAnalysis(req, res, next) {
  // La validation est déjà faite par le middleware dans videoRoutes.js
  const { youtubeUrl, transcriptionProvider } = req.body;
  
  try {
    // Le service retourne maintenant un objet { analysis, fromCache }
    const result = await videoService.startAnalysis(youtubeUrl, transcriptionProvider);

    if (result.fromCache) {
      // --- FIX #3 : Si c'est du cache, on renvoie 200 OK avec les données finales ---
      res.status(200).json(result.analysis);
    } else {
      // --- Sinon, on renvoie 202 Accepted pour lancer le polling ---
      res.status(202).json(result.analysis);
    }
  } catch (error) {
    next(error);
  }
}

async function getAnalysis(req, res, next) {
  const { id } = req.params;
  try {
    const analysis = await videoService.getAnalysisById(parseInt(id, 10));
    if (!analysis) {
      return res.status(404).json({ error: 'Analyse non trouvée.' });
    }
    res.status(200).json(analysis);
  } catch (error) {
    next(error);
  }
}

// --- NOUVEAU CONTRÔLEUR ---
async function rerunClaimExtraction(req, res, next) {
  const { id } = req.params;
  try {
    const analysis = await videoService.rerunClaimExtraction(parseInt(id, 10));
    res.status(202).json(analysis); // 202 Accepted: la tâche est lancée
  } catch (error) {
    next(error);
  }
}

module.exports = { createAnalysis, getAnalysis, rerunClaimExtraction };