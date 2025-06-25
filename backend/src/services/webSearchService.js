const axios = require('axios');

/**
 * Service pour effectuer des recherches web via l'API Serper
 * Encapsule tous les appels à l'API externe Serper
 */

/**
 * Effectue une recherche web via l'API Serper
 * @param {string} query - La requête de recherche
 * @returns {Promise<Array>} Tableau d'objets { title, link, snippet }
 */
async function search(query) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    console.warn('webSearchService.search: Requête vide ou invalide');
    return [];
  }

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error('SERPER_API_KEY non configurée dans les variables d\'environnement');
  }

  console.log(`🔍 Recherche web Serper: "${query}"`);

  try {
    const response = await axios.post(
      'https://google.serper.dev/search',
      {
        q: query,
        num: 10, // Nombre de résultats à récupérer
        gl: 'fr', // Géolocalisation France
        hl: 'fr'  // Langue française
      },
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // Timeout de 15 secondes
      }
    );

    if (!response.data || !response.data.organic) {
      console.warn(`webSearchService.search: Aucun résultat organique trouvé pour "${query}"`);
      return [];
    }

    // Formater les résultats selon le format attendu
    const results = response.data.organic.map(result => ({
      title: result.title || 'Titre non disponible',
      link: result.link || '',
      snippet: result.snippet || 'Extrait non disponible'
    }));

    console.log(`✅ webSearchService.search: ${results.length} résultats trouvés pour "${query}"`);
    return results;

  } catch (error) {
    console.error(`❌ webSearchService.search: Erreur lors de la recherche "${query}":`, error.message);
    
    // En cas d'erreur, retourner un tableau vide plutôt que de faire échouer tout le processus
    if (error.response) {
      console.error(`Statut HTTP: ${error.response.status}, Données: ${JSON.stringify(error.response.data)}`);
    }
    
    return [];
  }
}

/**
 * Effectue plusieurs recherches en parallèle avec gestion d'erreurs
 * @param {Array<string>} queries - Tableau de requêtes de recherche
 * @returns {Promise<Array>} Tableau de tous les résultats agrégés
 */
async function searchMultiple(queries) {
  if (!Array.isArray(queries) || queries.length === 0) {
    console.warn('webSearchService.searchMultiple: Aucune requête fournie');
    return [];
  }

  console.log(`🔍 Recherche multiple Serper: ${queries.length} requêtes`);

  try {
    // Exécuter toutes les recherches en parallèle
    const searchPromises = queries.map(query => search(query));
    const results = await Promise.all(searchPromises);
    
    // Agréger tous les résultats en un seul tableau
    const aggregatedResults = results.flat();
    
    // Supprimer les doublons basés sur l'URL
    const uniqueResults = aggregatedResults.filter((result, index, self) => 
      index === self.findIndex(r => r.link === result.link)
    );

    console.log(`✅ webSearchService.searchMultiple: ${uniqueResults.length} résultats uniques agrégés`);
    return uniqueResults;

  } catch (error) {
    console.error('❌ webSearchService.searchMultiple: Erreur lors des recherches multiples:', error.message);
    return [];
  }
}

module.exports = {
  search,
  searchMultiple
};