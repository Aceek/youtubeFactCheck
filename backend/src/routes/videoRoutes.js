const express = require('express');
const videoController = require('../controllers/videoController');

const router = express.Router();

router.post('/analyses', videoController.createAnalysis);
router.get('/analyses/:id', videoController.getAnalysis);

module.exports = router;