// Calcul du feedback pour un champ
function computeFieldFeedback(guessVal, targetVal, attribute) {
  // Si les deux sont identiques (y compris Unknown === Unknown), c'est correct
  if (guessVal && targetVal && guessVal.toString().toLowerCase() === targetVal.toString().toLowerCase()) {
    return { type: "correct", label: guessVal };
  }

  // Si un des deux est vide ou Unknown, c'est faux
  if (!guessVal || !targetVal || guessVal === "Unknown" || targetVal === "Unknown") {
    return { type: "wrong", label: guessVal || "-" };
  }

  const { type, order, partialMatch } = attribute;

  // Type numérique
  if (type === "number") {
    const g = Number(guessVal);
    const t = Number(targetVal);

    if (isNaN(g) || isNaN(t)) {
      return { type: guessVal === targetVal ? "correct" : "wrong", label: guessVal };
    }

    if (g === t) return { type: "correct", label: guessVal };
    if (Math.abs(g - t) === 1) return { type: "close", label: guessVal, direction: g > t ? "higher" : "lower" };
    if (g > t) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // Type ordonné (ex: arcs)
  if (type === "ordered" && order) {
    const guessIndex = order.findIndex(item =>
      guessVal.toLowerCase().includes(item.toLowerCase()) ||
      item.toLowerCase().includes(guessVal.toLowerCase())
    );
    const targetIndex = order.findIndex(item =>
      targetVal.toLowerCase().includes(item.toLowerCase()) ||
      item.toLowerCase().includes(targetVal.toLowerCase())
    );

    if (guessIndex === -1 || targetIndex === -1) {
      return { type: guessVal.toLowerCase() === targetVal.toLowerCase() ? "correct" : "wrong", label: guessVal };
    }

    if (guessIndex === targetIndex) return { type: "correct", label: guessVal };
    if (guessIndex > targetIndex) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // Type texte
  if (guessVal.toLowerCase() === targetVal.toLowerCase()) {
    return { type: "correct", label: guessVal };
  }

  // Match partiel (jaune) - activé par défaut pour le texte
  if (targetVal.toLowerCase().includes(guessVal.toLowerCase()) ||
      guessVal.toLowerCase().includes(targetVal.toLowerCase())) {
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
