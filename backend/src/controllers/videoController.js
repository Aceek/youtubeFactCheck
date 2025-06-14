const videoService = require('../services/videoService');

async function createAnalysis(req, res) {
  const { youtubeUrl, transcriptionProvider } = req.body;
  console.log(`Requête reçue pour créer une analyse pour l'URL: ${youtubeUrl}`);

  if (!youtubeUrl || !transcriptionProvider) {
    return res.status(400).json({ error: 'youtubeUrl and transcriptionProvider are required' });
  }

  try {
    const analysisResult = await videoService.startAnalysis(youtubeUrl, transcriptionProvider);
    res.status(201).json(analysisResult); // 201 Created est plus approprié
  } catch (error) {
    console.error('Error in createAnalysis controller:', error.message);
    // Renvoyer un message d'erreur plus utile au frontend
    res.status(500).json({ error: error.message || 'Failed to start analysis process' });
  }
}

module.exports = { createAnalysis };