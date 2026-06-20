const axios = require('axios');

/**
 * Service pour effectuer des recherches web via l'API Brave Search.
 * Encapsule tous les appels à l'API externe Brave.
 *
 * Le format de retour ({ title, link, snippet }) est conservé à l'identique
 * de l'ancien fournisseur Serper afin de ne rien changer en aval
 * (factCheckingService, corpus de preuves, LLM juge).
 *
 * ⚠️ Le plan gratuit Brave est limité à 1 requête/seconde (et 2000/mois).
 * Le pipeline de fact-checking lance plusieurs claims et plusieurs requêtes
 * en parallèle : sans régulation, on dépasse instantanément la limite (429)
 * et chaque claim retombe en "aucune source trouvée". On sérialise donc TOUS
 * les appels via un ordonnanceur global qui garantit un intervalle minimal.
 */

const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

// Intervalle minimal entre deux requêtes Brave (plan gratuit = 1 req/s).
// On garde une petite marge par défaut (1100 ms) pour absorber la gigue réseau.
const RATE_LIMIT_MS = parseInt(process.env.BRAVE_RATE_LIMIT_MS) || 1100;
// Nombre de tentatives en cas de 429 (limite de taux) avant d'abandonner.
const MAX_RETRIES = parseInt(process.env.BRAVE_RETRY_COUNT) || 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ordonnanceur global : enchaîne les requêtes les unes après les autres en
 * respectant un intervalle minimal entre chaque départ. Comme c'est un état
 * de module, il régule l'ensemble des appels concurrents du process.
 */
let queueTail = Promise.resolve();
let lastRequestTime = 0;

function scheduleRequest(fn) {
  const run = queueTail.then(async () => {
    const wait = Math.max(0, lastRequestTime + RATE_LIMIT_MS - Date.now());
    if (wait > 0) {
      await sleep(wait);
    }
    lastRequestTime = Date.now();
    return fn();
  });

  // La file ne doit jamais se rompre sur une erreur : on neutralise le rejet
  // pour la continuité de la chaîne, tout en propageant l'erreur à l'appelant.
  queueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * Effectue une recherche web via l'API Brave Search.
 * @param {string} query - La requête de recherche
 * @returns {Promise<Array>} Tableau d'objets { title, link, snippet }
 * @throws {Error} Si la clé est absente, ou en cas d'erreur API persistante
 *                 (auth, 429 après retries, réseau). Ces erreurs DOIVENT
 *                 remonter pour ne pas être confondues avec "aucun résultat".
 */
async function search(query) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    console.warn('webSearchService.search: Requête vide ou invalide');
    return [];
  }

  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error('BRAVE_API_KEY non configurée dans les variables d\'environnement');
  }

  console.log(`🔍 Recherche web Brave: "${query}"`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await scheduleRequest(() =>
        axios.get(BRAVE_SEARCH_ENDPOINT, {
          params: {
            q: query,
            count: 10,        // Nombre de résultats à récupérer (max 20)
            country: 'fr',    // Géolocalisation France
            search_lang: 'fr',
            ui_lang: 'fr-FR',
          },
          headers: {
            'X-Subscription-Token': apiKey,
            Accept: 'application/json',
          },
          timeout: 15000, // Timeout de 15 secondes
        })
      );

      const results = (response.data?.web?.results || []).map((result) => ({
        title: result.title || 'Titre non disponible',
        link: result.url || '',
        snippet: result.description || 'Extrait non disponible',
      }));

      // Un tableau vide ici est un VRAI "aucun résultat" (l'API a répondu 200).
      console.log(`✅ webSearchService.search: ${results.length} résultats trouvés pour "${query}"`);
      return results;

    } catch (error) {
      const status = error.response?.status;

      // 429 = limite de taux : on attend (back-off) puis on retente.
      if (status === 429 && attempt < MAX_RETRIES) {
        const backoff = RATE_LIMIT_MS * (attempt + 1);
        console.warn(`⏳ webSearchService.search: 429 (limite de taux) sur "${query}", nouvelle tentative ${attempt + 1}/${MAX_RETRIES} dans ${backoff}ms`);
        await sleep(backoff);
        continue;
      }

      // Toute autre erreur (ou 429 après épuisement des tentatives) est une
      // panne réelle : on la fait remonter au lieu de la déguiser en
      // "aucune source trouvée" (qui produirait un faux UNVERIFIABLE).
      console.error(`❌ webSearchService.search: Erreur lors de la recherche "${query}": ${error.message}`);
      if (error.response) {
        console.error(`Statut HTTP: ${status}, Données: ${JSON.stringify(error.response.data)}`);
        if (status === 401 || status === 403) {
          console.error('Erreur d\'authentification : vérifiez que BRAVE_API_KEY est valide et active.');
        }
      }
      throw error;
    }
  }

  // Inatteignable en théorie (la boucle retourne ou throw), garde-fou.
  throw new Error(`webSearchService.search: échec après ${MAX_RETRIES} tentatives pour "${query}"`);
}

/**
 * Effectue plusieurs recherches en respectant la limite de taux (les appels
 * sont sérialisés par l'ordonnanceur global). Tolère les échecs partiels :
 * si au moins une requête aboutit, on agrège ses résultats ; si TOUTES
 * échouent, on propage l'erreur pour que le claim soit marqué en échec réel.
 * @param {Array<string>} queries - Tableau de requêtes de recherche
 * @returns {Promise<Array>} Tableau de résultats uniques { title, link, snippet }
 */
async function searchMultiple(queries) {
  if (!Array.isArray(queries) || queries.length === 0) {
    console.warn('webSearchService.searchMultiple: Aucune requête fournie');
    return [];
  }

  console.log(`🔍 Recherche multiple Brave: ${queries.length} requêtes`);

  const settled = await Promise.allSettled(queries.map((query) => search(query)));

  const fulfilled = settled.filter((r) => r.status === 'fulfilled');

  // Si chaque requête a échoué, c'est une panne réelle de l'API : on remonte.
  if (fulfilled.length === 0) {
    const firstError = settled.find((r) => r.status === 'rejected')?.reason;
    throw new Error(
      `Toutes les recherches web ont échoué (${queries.length}/${queries.length})` +
        (firstError ? ` : ${firstError.message}` : '')
    );
  }

  const failedCount = settled.length - fulfilled.length;
  if (failedCount > 0) {
    console.warn(`⚠️ webSearchService.searchMultiple: ${failedCount}/${queries.length} requêtes en échec (résultats partiels utilisés)`);
  }

  // Agréger puis dédupliquer par URL.
  const aggregatedResults = fulfilled.flatMap((r) => r.value);
  const uniqueResults = aggregatedResults.filter(
    (result, index, self) => index === self.findIndex((r) => r.link === result.link)
  );

  console.log(`✅ webSearchService.searchMultiple: ${uniqueResults.length} résultats uniques agrégés`);
  return uniqueResults;
}

module.exports = {
  search,
  searchMultiple,
};
