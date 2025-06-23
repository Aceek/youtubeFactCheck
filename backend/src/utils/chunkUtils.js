/**
 * Utilitaires pour le découpage en chunks des transcriptions
 */

/**
 * Découpe une liste de paragraphes en chunks avec chevauchement
 * @param {Array} paragraphs - Liste des paragraphes de la transcription
 * @param {number} chunkSize - Nombre de paragraphes par chunk
 * @param {number} chunkOverlap - Nombre de paragraphes de chevauchement
 * @returns {Array} Liste des chunks avec id et text formaté
 */
function chunkTranscript(paragraphs, chunkSize, chunkOverlap) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    console.warn('chunkTranscript: Liste de paragraphes vide ou invalide');
    return [];
  }

  const chunks = [];
  let chunkIndex = 0;
  
  for (let i = 0; i < paragraphs.length; i += (chunkSize - chunkOverlap)) {
    const endIndex = Math.min(i + chunkSize, paragraphs.length);
    const chunkParagraphs = paragraphs.slice(i, endIndex);
    
    // Formatage du texte avec les balises de timestamp
    const formattedText = chunkParagraphs.map(para => {
      const timestamp = Math.round(para.start / 1000);
      return `[t=${timestamp}] ${para.text}`;
    }).join('\n\n');
    
    chunks.push({
      id: chunkIndex,
      text: formattedText,
      startTime: Math.round(chunkParagraphs[0].start / 1000),
      endTime: Math.round(chunkParagraphs[chunkParagraphs.length - 1].end / 1000),
      paragraphIndices: { start: i, end: endIndex - 1 }
    });
    
    chunkIndex++;
    
    // Si on a atteint la fin, on s'arrête
    if (endIndex >= paragraphs.length) {
      break;
    }
  }
  
  console.log(`Transcription découpée en ${chunks.length} chunks (taille: ${chunkSize}, chevauchement: ${chunkOverlap})`);
  return chunks;
}

/**
 * Trouve les claims qui appartiennent à un chunk donné basé sur leur timestamp
 * @param {Array} claims - Liste des claims avec timestamp
 * @param {Object} chunk - Chunk avec startTime et endTime
 * @returns {Array} Claims qui appartiennent à ce chunk
 */
function getClaimsForChunk(claims, chunk) {
  return claims.filter(claim => {
    // Un claim appartient à un chunk si son timestamp est dans la plage du chunk
    // On ajoute une petite marge pour les cas limites
    const margin = 5; // 5 secondes de marge
    return claim.timestamp >= (chunk.startTime - margin) && 
           claim.timestamp <= (chunk.endTime + margin);
  });
}

module.exports = {
  chunkTranscript,
  getClaimsForChunk
};