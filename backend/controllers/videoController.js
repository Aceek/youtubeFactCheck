const videoService = require('../services/videoService');

async function factCheck(req, res) {
  console.log(`factCheck: Requête reçue pour l'URL ${req.body.youtube_url}`);
  const { youtube_url } = req.body;

  if (!youtube_url) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  try {
    let video = await videoService.getVideo(youtube_url);

    if (!video) {
      video = await videoService.createVideo(youtube_url);
    }

    res.json({ video });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process fact-check' });
  }
}

module.exports = { factCheck };