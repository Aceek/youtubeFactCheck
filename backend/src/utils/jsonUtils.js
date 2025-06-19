function extractJsonFromString(str) {
  try {
    const jsonMatch = str.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    return null;
  } catch (error) {
    console.error("Erreur lors de l'extraction JSON:", error);
    return null;
  }
}

module.exports = { extractJsonFromString };