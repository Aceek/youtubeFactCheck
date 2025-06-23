// backend/src/services/debugLogService.js
const fs = require('fs');
const path = require('path');

const isDebugMode = process.env.DEBUG_MODE === 'true';

/**
 * Service de logging conditionnel pour le débogage.
 * N'écrit des fichiers que si DEBUG_MODE est activé.
 */
const debugLogService = {
  /**
   * Enregistre du contenu dans un fichier de débogage.
   * @param {number} analysisId - L'ID de l'analyse en cours.
   * @param {string} fileName - Le nom du fichier (ex: '1_extraction_prompt.txt').
   * @param {string} content - Le contenu à écrire.
   */
  log: (analysisId, fileName, content, subfolder = null) => {
    if (!isDebugMode) {
      return;
    }
    
    try {
      // Crée un sous-dossier par analyse pour une meilleure organisation
      const analysisDir = path.resolve(`./results/${analysisId}`);
      
      // Si un sous-dossier est spécifié, on l'ajoute au chemin
      const targetDir = subfolder
        ? path.join(analysisDir, subfolder)
        : analysisDir;
      
      fs.mkdirSync(targetDir, { recursive: true });

      const filePath = path.join(targetDir, fileName);
      fs.writeFileSync(filePath, content);
      console.log(`[DEBUG] Log sauvegardé dans : ${filePath}`);
    } catch (error) {
      console.error(`[DEBUG] Erreur lors de l'écriture du log ${fileName}:`, error);
    }
  }
};

module.exports = debugLogService;