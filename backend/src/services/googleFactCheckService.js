const axios = require('axios');

/**
 * Service pour interroger l'API Google Fact Check
 * Encapsule tous les appels à l'API Google Fact Check Tools
 */

/**
 * Normalise le verdict de l'API Google vers nos valeurs standardisées
 * @param {string} googleVerdict - Le verdict brut de l'API Google
 * @returns {string} Verdict normalisé (TRUE, FALSE, MISLEADING)
 */
function normalizeGoogleVerdict(googleVerdict) {
  if (!googleVerdict || typeof googleVerdict !== 'string') {
    return 'MISLEADING';
  }

  const verdict = googleVerdict.toLowerCase();
  
  // Mapping des verdicts Google vers nos valeurs
  if (verdict.includes('true') || verdict.includes('correct') || verdict.includes('accurate')) {
    return 'TRUE';
  }
  
  if (verdict.includes('false') || verdict.includes('incorrect') || verdict.includes('wrong')) {
    return 'FALSE';
  }
  
  // Par défaut, considérer comme trompeur si pas clairement vrai ou faux
  return 'MISLEADING';
}

/**
 * Interroge l'API Google Fact Check pour une affirmation donnée
 * @param {string} claimText - Le texte de l'affirmation à vérifier
 * @returns {Promise<Object|null>} Objet formaté avec verdict, sourceName, sourceUrl ou null si aucun résultat
 */
async function query(claimText) {
  if (!claimText || typeof claimText !== 'string' || claimText.trim().length === 0) {
    console.warn('googleFactCheckService.query: Texte de claim vide ou invalide');
    return null;
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY non configurée dans les variables d\'environnement');
  }

  console.log(`🔍 Google Fact Check: "${claimText.substring(0, 100)}..."`);

  try {
    const response = await axios.get('https://factchecktools.googleapis.com/v1alpha1/claims:search', {
      params: {
        key: apiKey,
        query: claimText,
        languageCode: 'fr', // Priorité au français
        maxAgeDays: 365 * 2, // Résultats des 2 dernières années
        pageSize: 10 // Nombre maximum de résultats
      },
      timeout: 15000 // Timeout de 15 secondes
    });

    if (!response.data || !response.data.claims || response.data.claims.length === 0) {
      console.log(`ℹ️ googleFactCheckService.query: Aucun fact-check trouvé pour "${claimText.substring(0, 50)}..."`);
      return null;
    }

    // Prendre le premier résultat (le plus pertinent selon Google)
    const firstClaim = response.data.claims[0];
    
    if (!firstClaim.claimReview || firstClaim.claimReview.length === 0) {
      console.warn('googleFactCheckService.query: Claim trouvé mais sans claimReview');
      return null;
    }

    const review = firstClaim.claimReview[0];
    
    // Extraire les informations nécessaires
    const googleVerdict = review.textualRating || '';
    const sourceName = review.publisher?.name || 'Source inconnue';
    const sourceUrl = review.url || '';

    // Normaliser le verdict
    const normalizedVerdict = normalizeGoogleVerdict(googleVerdict);

    const result = {
      verdict: normalizedVerdict,
      sourceName: sourceName,
      sourceUrl: sourceUrl,
      originalRating: googleVerdict, // Garder le verdict original pour debug
      claimText: firstClaim.text || claimText
    };

    console.log(`✅ googleFactCheckService.query: Fact-check trouvé - Verdict: ${normalizedVerdict} (${googleVerdict}) par ${sourceName}`);
    return result;

  } catch (error) {
    console.error(`❌ googleFactCheckService.query: Erreur lors de la recherche:`, error.message);
    
    if (error.response) {
      console.error(`Statut HTTP: ${error.response.status}`);
      if (error.response.status === 403) {
        console.error('Erreur 403: Vérifiez que l\'API Google Fact Check est activée et que la clé API est valide');
      } else if (error.response.status === 429) {
        console.error('Erreur 429: Limite de taux atteinte pour l\'API Google Fact Check');
      }
    }
    
    // En cas d'erreur, retourner null plutôt que de faire échouer tout le processus
    return null;
  }
}

/**
 * Effectue des requêtes Google Fact Check pour plusieurs claims en parallèle
 * @param {Array<string>} claimTexts - Tableau de textes d'affirmations
 * @returns {Promise<Array>} Tableau de résultats (null pour les claims sans résultat)
 */
async function queryMultiple(claimTexts) {
  if (!Array.isArray(claimTexts) || claimTexts.length === 0) {
    console.warn('googleFactCheckService.queryMultiple: Aucun claim fourni');
    return [];
  }

  console.log(`🔍 Google Fact Check multiple: ${claimTexts.length} claims`);

  try {
    // Limiter la concurrence pour respecter les limites de l'API Google
    const concurrencyLimit = 3;
    const results = [];

    for (let i = 0; i < claimTexts.length; i += concurrencyLimit) {
      const batch = claimTexts.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(claimText => query(claimText));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Petite pause entre les lots pour respecter les limites de taux
      if (i + concurrencyLimit < claimTexts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const foundResults = results.filter(result => result !== null);
    console.log(`✅ googleFactCheckService.queryMultiple: ${foundResults.length}/${claimTexts.length} fact-checks trouvés`);
    
    return results;

  } catch (error) {
    console.error('❌ googleFactCheckService.queryMultiple: Erreur lors des requêtes multiples:', error.message);
    return claimTexts.map(() => null); // Retourner un tableau de null de la même taille
  }
}

module.exports = {
  query,
  queryMultiple,
  normalizeGoogleVerdict
};