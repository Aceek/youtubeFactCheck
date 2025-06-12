require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { YoutubeTranscript } = require('youtube-transcript');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', (req, res) => {
  res.send('Fact-Check Backend is running');
});

app.post('/fact-check', async (req, res) => {
  const { youtube_url } = req.body;

  if (!youtube_url) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  try {
    let video = await prisma.video.findUnique({
      where: { youtubeUrl: youtube_url },
    });

    if (!video) {
      const transcript = await YoutubeTranscript.fetchTranscript(youtube_url);
      const transcriptText = transcript.map(item => item.text).join(' ');

      video = await prisma.video.create({
        data: {
          youtubeUrl: youtube_url,
          transcript: transcriptText,
        },
      });
    }

    res.json({ video });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process fact-check' });
  }
});

app.listen(3000, () => {
  console.log('Backend running at http://localhost:3000');
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});