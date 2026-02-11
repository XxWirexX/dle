// Calcul du feedback pour un champ
function computeFieldFeedback(guessVal, targetVal, attribute) {
  const { type, order, groups } = attribute;

  // Type multiple (tableaux de valeurs, ex: haki)
  if (type === "multiple") {
    const gArray = Array.isArray(guessVal) ? guessVal : [];
    const tArray = Array.isArray(targetVal) ? targetVal : [];
    const gSet = new Set(gArray.map(v => v.toLowerCase()));
    const tSet = new Set(tArray.map(v => v.toLowerCase()));

    const label = gArray.length > 0 ? gArray.join(", ") : "None";

    // Si les deux sont vides, c'est correct
    if (gSet.size === 0 && tSet.size === 0) {
      return { type: "correct", label };
    }

    // Si un seul est vide, c'est wrong
    if (gSet.size === 0 || tSet.size === 0) {
      return { type: "wrong", label };
    }

    // Si identiques (mêmes éléments)
    if (gSet.size === tSet.size && [...gSet].every(v => tSet.has(v))) {
      return { type: "correct", label };
    }

    // Si au moins un élément en commun
    const hasCommon = [...gSet].some(v => tSet.has(v));
    if (hasCommon) {
      return { type: "close", label };
    }

    return { type: "wrong", label };
  }

  const gLower = guessVal ? guessVal.toString().toLowerCase() : null;
  const tLower = targetVal ? targetVal.toString().toLowerCase() : null;

  // Si les deux sont identiques (y compris "unknown" === "unknown"), c'est correct
  if (gLower && tLower && gLower === tLower) {
    return { type: "correct", label: guessVal };
  }

  // Vérifier si un des deux est vide ou "unknown"
  const gIsUnknown = !gLower || gLower === "unknown";
  const tIsUnknown = !tLower || tLower === "unknown";

  // Pour les types ordered, vérifier si "unknown" est dans l'ordre avant de le rejeter
  if (type === "ordered" && order) {
    const unknownInOrder = order.some(item => item.toLowerCase() === "unknown");
    if (!unknownInOrder && (gIsUnknown || tIsUnknown)) {
      return { type: "wrong", label: guessVal || "-" };
    }
  } else if (gIsUnknown || tIsUnknown) {
    return { type: "wrong", label: guessVal || "-" };
  }

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

  // Type ordonné (ex: arcs, ranks)
  if (type === "ordered" && order) {
    // Utiliser une correspondance exacte pour éviter les faux positifs (Dragon vs Above Dragon)
    const guessIndex = order.findIndex(item => item.toLowerCase() === gLower);
    const targetIndex = order.findIndex(item => item.toLowerCase() === tLower);

    if (guessIndex === -1 || targetIndex === -1) {
      return { type: "wrong", label: guessVal };
    }

    if (guessIndex === targetIndex) return { type: "correct", label: guessVal };
    if (Math.abs(guessIndex - targetIndex) === 1) return { type: "close", label: guessVal, direction: guessIndex > targetIndex ? "higher" : "lower" };
    if (guessIndex > targetIndex) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // Type text-group - groupes de valeurs considérées comme "proches"
  if (type === "text-group" && groups) {
    // Chercher si les deux valeurs sont dans le même groupe
    for (const group of groups) {
      const groupLower = group.map(g => g.toLowerCase());
      const gInGroup = groupLower.some(item => gLower.includes(item) || item.includes(gLower));
      const tInGroup = groupLower.some(item => tLower.includes(item) || item.includes(tLower));
      if (gInGroup && tInGroup) {
        return { type: "close", label: guessVal };
      }
    }
    // Sinon, appliquer la logique text standard (substring matching)
  }

  // Exception pour male/female (female contient male mais c'est pas un match)
  const isMaleFemale = (gLower === "male" && tLower === "female") || (gLower === "female" && tLower === "male");

  // Type texte - match partiel (jaune) si l'un contient l'autre
  if (!isMaleFemale && (tLower.includes(gLower) || gLower.includes(tLower))) {
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
