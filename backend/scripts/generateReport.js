// backend/scripts/generateReport.js

// Ce script est destiné à être exécuté manuellement pour générer
// ou regénérer le rapport final d'une analyse existante.

const { generateAndSaveFinalReport } = require('../src/services/reportService');
const prisma = require('../src/client');

async function main() {
  // 1. Récupérer l'ID de l'analyse depuis les arguments de la ligne de commande
  const analysisIdArg = process.argv[2];
  
  if (!analysisIdArg) {
    console.error("❌ Erreur : Veuillez fournir un ID d'analyse.");
    console.log("   Usage: node scripts/generateReport.js <ANALYSIS_ID>");
    process.exit(1);
  }

  const analysisId = parseInt(analysisIdArg, 10);
  if (isNaN(analysisId)) {
    console.error(`❌ Erreur : L'ID fourni "${analysisIdArg}" n'est pas un nombre valide.`);
    process.exit(1);
  }

  // 2. Vérifier que le DEBUG_MODE est activé pour pouvoir écrire des fichiers
  if (process.env.DEBUG_MODE !== 'true') {
      console.warn("⚠️ Attention : DEBUG_MODE n'est pas activé ('true').");
      console.warn("   Le script va s'exécuter mais aucun fichier ne sera écrit.");
      console.warn("   Pour générer les fichiers, veuillez définir DEBUG_MODE=true dans votre .env");
  }

  console.log(`\n▶️  Lancement de la génération du rapport pour l'analyse ID: ${analysisId}`);
  
  try {
    // 3. Vérifier que l'analyse existe
    const analysisExists = await prisma.analysis.findUnique({ where: { id: analysisId } });
    if (!analysisExists) {
        console.error(`❌ Erreur : Aucune analyse trouvée avec l'ID ${analysisId}.`);
        await prisma.$disconnect();
        process.exit(1);
    }

    // 4. Appeler le service de reporting
    const success = await generateAndSaveFinalReport(analysisId);

    if (success) {
        console.log(`\n✅ Tâche terminée avec succès.`);
    } else {
        console.log(`\n❌ La tâche s'est terminée avec des erreurs. Veuillez vérifier les logs ci-dessus.`);
    }

  } catch (error) {
    console.error("❌ Une erreur inattendue est survenue lors de l'exécution du script:", error);
  } finally {
    // 5. Fermer la connexion à la base de données et terminer
    await prisma.$disconnect();
  }
}

main();