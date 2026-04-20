export function computeFieldFeedback(guessVal, targetVal, attribute) {
  const gLower = guessVal ? guessVal.toString().toLowerCase() : null;
  const tLower = targetVal ? targetVal.toString().toLowerCase() : null;

  if (gLower && tLower && gLower === tLower) {
    return { type: "correct", label: guessVal };
  }

  const gIsUnknown = !gLower || gLower === "unknown";
  const tIsUnknown = !tLower || tLower === "unknown";

  if (gIsUnknown || tIsUnknown) {
    return { type: "wrong", label: guessVal || "-" };
  }

  const { type, order } = attribute;

  if (type === "number") {
    const g = Number(guessVal);
    const t = Number(targetVal);
    if (isNaN(g) || isNaN(t)) return { type: "wrong", label: guessVal };
    if (g === t) return { type: "correct", label: guessVal };
    if (g > t) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  if (type === "ordered" && order) {
    const guessIndex = order.findIndex(item =>
      gLower.includes(item.toLowerCase()) || item.toLowerCase().includes(gLower)
    );
    const targetIndex = order.findIndex(item =>
      tLower.includes(item.toLowerCase()) || item.toLowerCase().includes(tLower)
    );
    if (guessIndex === -1 || targetIndex === -1) return { type: "wrong", label: guessVal };
    if (guessIndex === targetIndex) return { type: "correct", label: guessVal };
    if (guessIndex > targetIndex) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // type "multi" : jaune si au moins une valeur en commun (pour futurs attributs multi-valeurs)
  if (type === "multi") {
    const gSet = new Set(guessVal?.toString().toLowerCase().split(",").map(v => v.trim()));
    const tSet = new Set(targetVal?.toString().toLowerCase().split(",").map(v => v.trim()));
    const hasOverlap = [...gSet].some(v => tSet.has(v));
    if (hasOverlap) {
      const isExact = gSet.size === tSet.size && [...gSet].every(v => tSet.has(v));
      return isExact
        ? { type: "correct", label: guessVal }
        : { type: "close", label: guessVal };
    }
    return { type: "wrong", label: guessVal };
  }

  return { type: "wrong", label: guessVal };
}

export function getFeedbackObject(guess, target, attributes) {
  const obj = {};
  attributes.forEach(attr => {
    obj[attr.key] = computeFieldFeedback(guess[attr.key], target[attr.key], attr);
  });
  return obj;
}
