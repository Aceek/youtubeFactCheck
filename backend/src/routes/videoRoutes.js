const express = require('express');
const videoController = require('../controllers/videoController');

const router = express.Router();

router.post('/analyses', videoController.createAnalysis);

module.exports = router;