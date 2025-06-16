const express = require('express');
const cors = require('cors');
const videoRoutes = require('./src/routes/videoRoutes');

const app = express();
// Alignement du port sur 3001 pour être cohérent avec docker-compose.yml
const PORT = process.env.PORT || 3001;

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Routes ---
app.use('/api', videoRoutes);
console.log("Routes initialisées sur le chemin /api");

// --- Gestion des erreurs ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Une erreur interne inattendue est survenue.' });
});

// --- Démarrage du serveur ---
app.listen(PORT, () => {
  console.log(`🚀 Le serveur est lancé et écoute sur le port ${PORT}`);
});