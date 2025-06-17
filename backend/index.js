const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const videoRoutes = require('./src/routes/videoRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middlewares de Sécurité ---

// 1. Rate Limiter : limite chaque IP à 20 requêtes toutes les 15 minutes sur l'API
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
  message: { error: "Trop de requêtes envoyées depuis cette IP, veuillez réessayer après 15 minutes." }
});

app.use('/api', apiLimiter); // Applique le rate limiter à toutes les routes /api

// 2. Limiteur de taille de payload
app.use(express.json({ limit: '2kb' })); // Limite la taille des JSON entrants

// 3. CORS
app.use(cors());

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