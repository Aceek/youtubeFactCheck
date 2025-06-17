const express = require('express');
const videoController = require('../controllers/videoController');
const { validateCreateAnalysis } = require('../middlewares/validationMiddleware');

const router = express.Router();

router.post('/analyses', validateCreateAnalysis, videoController.createAnalysis);
router.get('/analyses/:id', videoController.getAnalysis);

// --- NOUVELLE ROUTE ---
// Déclenche une nouvelle extraction des "claims" pour une analyse existante.
router.post('/analyses/:id/rerun-claim-extraction', videoController.rerunClaimExtraction);

module.exports = router;