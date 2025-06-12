const { PrismaClient } = require('@prisma/client');
const { YoutubeTranscript } = require('youtube-transcript');

const prisma = new PrismaClient();

async function getVideo(youtubeUrl) {
  console.log(`getVideo: Récupération de la vidéo pour l'URL ${youtubeUrl}`);
  try {
    let video = await prisma.video.findUnique({
      where: { youtubeUrl: youtubeUrl },
    });
    console.log(`getVideo: Vidéo récupérée avec succès pour l'URL ${youtubeUrl}`);
    return video;
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Failed to get video');
  }
}

async function createVideo(youtubeUrl) {
  console.log(`createVideo: Création d'une vidéo pour l'URL ${youtubeUrl}`);
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(youtubeUrl);
    const transcriptText = transcript.map(item => item.text).join(' ');

    if (transcriptText.length > 0) {
      const video = await prisma.video.create({
        data: {
          youtubeUrl: youtubeUrl,
          transcript: transcriptText,
        },
      });
      const transcriptSnippet = transcriptText.substring(0, 100);
      console.log(`createVideo: Vidéo créée avec succès pour l'URL ${youtubeUrl}. Extrait de la transcription: ${transcriptSnippet}`);
      return video;
    } else {
      console.log(`createVideo: La transcription est vide pour l'URL ${youtubeUrl}`);
      return null;
    }
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Failed to create video');
  }
}

module.exports = { getVideo, createVideo };