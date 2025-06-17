const express = require('express');
const cors = require('cors');
// On exporte les limiteurs pour les utiliser dans les routes
const { heavyApiLimiter, pollingLimiter } = require('./src/middlewares/rateLimitMiddleware'); // Nous allons créer ce fichier
const videoRoutes = require('./src/routes/videoRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middlewares ---

// 1. CORS - IMPORTANT : Doit être en premier pour s'appliquer à toutes les réponses, y compris les erreurs
app.use(cors());

// 3. Limiteur de taille de payload
app.use(express.json({ limit: '2kb' })); // Limite la taille des JSON entrants

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