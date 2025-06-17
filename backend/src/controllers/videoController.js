const videoService = require('../services/videoService');

async function createAnalysis(req, res, next) {
  // La validation est déjà faite par le middleware dans videoRoutes.js
  const { youtubeUrl, transcriptionProvider } = req.body;
  
  try {
    const initialAnalysis = await videoService.startAnalysis(youtubeUrl, transcriptionProvider);
    res.status(202).json(initialAnalysis);
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

module.exports = { createAnalysis, getAnalysis };