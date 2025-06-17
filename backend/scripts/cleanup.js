// Importe les librairies nécessaires
const { PrismaClient } = require('@prisma/client');
const inquirer = require('inquirer');
const path = require('path');

// Charge les variables d'environnement du backend
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// On utilise directement la variable DATABASE_URL du .env (pas de remplacement d'hôte)
const prisma = new PrismaClient();

// Fonction pour ajouter une confirmation avant une action destructive
async function confirmAction(action) {
  const { confirmation } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmation',
      message: `Êtes-vous sûr de vouloir ${action} ? Cette action est irréversible.`,
      default: false,
    },
  ]);
  return confirmation;
}

// Fonction principale qui gère le menu interactif
async function main() {
  try {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Que souhaitez-vous nettoyer dans la base de données ?',
        choices: [
          { name: 'Toutes les Analyses (et données associées)', value: 'all_analyses' },
          { name: 'Seulement les "Claims" de toutes les analyses', value: 'claims_only' },
          // Séparateur supprimé pour compatibilité maximale
          { name: '-----------------------------', value: 'separator', disabled: true },
          { name: 'Annuler et quitter', value: 'cancel' },
        ],
        filter: (val) => (val === 'separator' ? undefined : val),
      },
    ]);

    if (action === 'separator' || !action) {
      console.log('Opération annulée.');
      return;
    }

    switch (action) {
      case 'all_analyses':
        if (await confirmAction('supprimer TOUTES les analyses, transcriptions et affirmations')) {
          // L'ordre est important pour respecter les contraintes de la base de données
          const deletedClaims = await prisma.claim.deleteMany();
          console.log(`- ${deletedClaims.count} affirmations supprimées.`);
          const deletedTranscriptions = await prisma.transcription.deleteMany();
          console.log(`- ${deletedTranscriptions.count} transcriptions supprimées.`);
          const deletedAnalyses = await prisma.analysis.deleteMany();
          console.log(`- ${deletedAnalyses.count} analyses supprimées.`);
          console.log('\n✅ Nettoyage complet des analyses terminé.');
        } else {
          console.log('Opération annulée.');
        }
        break;

      case 'claims_only':
        if (await confirmAction('supprimer UNIQUEMENT les affirmations (claims)')) {
          const deletedClaims = await prisma.claim.deleteMany();
          // On doit aussi mettre à jour les analyses pour refléter ce changement
          await prisma.analysis.updateMany({
            data: { status: 'TRANSCRIBING', llmModel: null },
          });
          console.log(`\n✅ ${deletedClaims.count} affirmations supprimées et analyses réinitialisées.`);
        } else {
          console.log('Opération annulée.');
        }
        break;

      case 'cancel':
        console.log('Opération annulée.');
        break;
    }
  } catch (e) {
    console.error('\n❌ Une erreur est survenue lors du nettoyage :', e.message);
  } finally {
    // Assure que la connexion à la base de données est toujours fermée
    await prisma.$disconnect();
    console.log('\nConnexion à la base de données fermée.');
  }
}

main();