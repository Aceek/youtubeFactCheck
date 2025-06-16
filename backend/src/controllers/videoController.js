const videoService = require('../services/videoService');

async function createAnalysis(req, res, next) {
  const { youtubeUrl, transcriptionProvider } = req.body;
  if (!youtubeUrl || !transcriptionProvider) {
    return res.status(400).json({ error: 'youtubeUrl and transcriptionProvider are required' });
  }

  try {
    // On ne 'await' PAS le processus complet. On le lance en arrière-plan.
    // Et on renvoie immédiatement la première version de l'analyse.
    const initialAnalysis = await videoService.startAnalysis(youtubeUrl, transcriptionProvider);
    res.status(202).json(initialAnalysis); // 202 Accepted: La requête est acceptée, mais le traitement n'est pas terminé.
  } catch (error) {
    next(error); // On passe l'erreur au gestionnaire global
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