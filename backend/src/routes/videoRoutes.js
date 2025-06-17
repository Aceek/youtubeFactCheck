const express = require('express');
const videoController = require('../controllers/videoController');
const { validateCreateAnalysis } = require('../middlewares/validationMiddleware');
// On importe nos nouveaux limiteurs
const { heavyApiLimiter, pollingLimiter } = require('../middlewares/rateLimitMiddleware');

const router = express.Router();

// Route coûteuse : Lancer une analyse. On applique le limiteur strict.
router.post('/analyses', heavyApiLimiter, validateCreateAnalysis, videoController.createAnalysis);

// Route peu coûteuse : Récupérer le statut. On applique le limiteur souple.
router.get('/analyses/:id', pollingLimiter, videoController.getAnalysis);

// Route coûteuse : Relancer l'extraction. On applique le limiteur strict.
router.post('/analyses/:id/rerun-claim-extraction', heavyApiLimiter, videoController.rerunClaimExtraction);

module.exports = router;