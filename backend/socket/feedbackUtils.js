// Calcul du feedback pour un champ
function computeFieldFeedback(guessVal, targetVal, attribute) {
  const gLower = guessVal ? guessVal.toString().toLowerCase() : null;
  const tLower = targetVal ? targetVal.toString().toLowerCase() : null;

  // Si les deux sont identiques (y compris "unknown" === "unknown"), c'est correct
  if (gLower && tLower && gLower === tLower) {
    return { type: "correct", label: guessVal };
  }

  // Vérifier si un des deux est vide ou "unknown"
  const gIsUnknown = !gLower || gLower === "unknown";
  const tIsUnknown = !tLower || tLower === "unknown";

  // Si un des deux est unknown (mais pas les deux, car déjà géré au-dessus)
  if (gIsUnknown || tIsUnknown) {
    return { type: "wrong", label: guessVal || "-" };
  }

  const { type, order } = attribute;

  // Type numérique
  if (type === "number") {
    const g = Number(guessVal);
    const t = Number(targetVal);

    if (isNaN(g) || isNaN(t)) {
      return { type: "wrong", label: guessVal };
    }

    if (g === t) return { type: "correct", label: guessVal };
    if (Math.abs(g - t) === 1) return { type: "close", label: guessVal, direction: g > t ? "higher" : "lower" };
    if (g > t) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // Type ordonné (ex: arcs)
  if (type === "ordered" && order) {
    const guessIndex = order.findIndex(item =>
      gLower.includes(item.toLowerCase()) ||
      item.toLowerCase().includes(gLower)
    );
    const targetIndex = order.findIndex(item =>
      tLower.includes(item.toLowerCase()) ||
      item.toLowerCase().includes(tLower)
    );

    if (guessIndex === -1 || targetIndex === -1) {
      return { type: "wrong", label: guessVal };
    }

    if (guessIndex === targetIndex) return { type: "correct", label: guessVal };
    if (Math.abs(guessIndex - targetIndex) === 1) return { type: "close", label: guessVal, direction: guessIndex > targetIndex ? "higher" : "lower" };
    if (guessIndex > targetIndex) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // Type texte - match partiel (jaune) si l'un contient l'autre
  if (tLower.includes(gLower) || gLower.includes(tLower)) {
    return { type: "close", label: guessVal };
  }

  return { type: "wrong", label: guessVal };
}

// Calcul du feedback pour tous les attributs
function getFeedbackObject(guess, target, attributes) {
  const obj = {};
  attributes.forEach((attr) => {
    obj[attr.key] = computeFieldFeedback(guess[attr.key], target[attr.key], attr);
  });
  return obj;
}

module.exports = { computeFieldFeedback, getFeedbackObject };
