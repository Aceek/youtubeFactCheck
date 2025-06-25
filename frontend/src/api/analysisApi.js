const API_URL = import.meta.env.VITE_API_URL;

export async function createAnalysis(youtubeUrl, transcriptionProvider, withValidation, withFactChecking) { // Ajout des paramètres
  const response = await fetch(`${API_URL}/analyses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ youtubeUrl, transcriptionProvider, withValidation, withFactChecking }), // Ajout dans le body
  });

  const data = await response.json();

  if (!response.ok) {
    // L'API renvoie maintenant une erreur utile
    throw new Error(data.error || `Erreur ${response.status}`);
  }

  return data;
}

export async function fetchAnalysis(id) {
  const response = await fetch(`${API_URL}/analyses/${id}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Erreur ${response.status}`);
  }
  return data;
}

export async function reRunClaims(id, withValidation, withFactChecking) { // <-- Accepte les paramètres
  const response = await fetch(`${API_URL}/analyses/${id}/rerun-claim-extraction`, {
    method: 'POST',
    // --- CORRECTION : On ajoute le body et le header ---
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ withValidation, withFactChecking }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Erreur ${response.status}`);
  }
  return data;
}