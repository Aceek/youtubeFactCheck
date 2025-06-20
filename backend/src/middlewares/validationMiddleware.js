const { body, validationResult } = require('express-validator');

// Middleware de validation pour la création d'une analyse
const validateCreateAnalysis = [
  // 1. Valider le format de l'URL
  body('youtubeUrl')
    .isURL({ protocols: ['http', 'https'], require_protocol: true, host_whitelist: ['www.youtube.com', 'youtube.com', 'youtu.be'] })
    .withMessage('L\'URL fournie doit être une URL YouTube valide.'),

  // 2. Valider le fournisseur
  body('transcriptionProvider')
    .isIn(['ASSEMBLY_AI', 'MOCK_PROVIDER'])
    .withMessage('Le fournisseur de transcription est invalide.'),

  // 3. Gérer les erreurs de validation
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // On renvoie directement le message de la PREMIÈRE erreur pour une consommation simple par le frontend.
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
  }
];

module.exports = { validateCreateAnalysis };