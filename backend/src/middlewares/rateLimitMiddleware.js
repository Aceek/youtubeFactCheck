// backend/src/middlewares/rateLimitMiddleware.js

const rateLimit = require('express-rate-limit');

// Limiteur strict pour les opérations coûteuses (création, ré-analyse)
const heavyApiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 15, // Un peu moins, pour les actions qui comptent vraiment
	standardHeaders: true,
	legacyHeaders: false,
    message: { error: "Trop de nouvelles analyses demandées. Veuillez patienter 15 minutes." }
});

// Limiteur beaucoup plus souple pour le polling.
// Le front interroge le statut toutes les ~2 s pendant une analyse active
// (pour l'affichage "live") : sur une fenêtre de 5 min cela peut atteindre
// ~150 requêtes pour une longue analyse, on garde donc une marge confortable.
const pollingLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 300, // ~1 requête/seconde soutenue : large pour le polling live
	standardHeaders: true,
	legacyHeaders: false,
    message: { error: "Trop de requêtes de statut. Un problème est peut-être survenu." }
});

module.exports = { heavyApiLimiter, pollingLimiter };