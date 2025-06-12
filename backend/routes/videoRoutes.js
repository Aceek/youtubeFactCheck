const express = require('express');
const videoController = require('../controllers/videoController');

const router = express.Router();

router.post('/fact-check', videoController.factCheck);

module.exports = router;