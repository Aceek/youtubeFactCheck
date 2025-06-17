const express = require('express');
const videoController = require('../controllers/videoController');
const { validateCreateAnalysis } = require('../middlewares/validationMiddleware');

const router = express.Router();

router.post('/analyses', validateCreateAnalysis, videoController.createAnalysis);
router.get('/analyses/:id', videoController.getAnalysis);

module.exports = router;