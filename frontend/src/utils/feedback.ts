import { FeedbackType, AttributeType } from '../constants/enums';
import type { Attribute } from '../types/anime';
import type { FieldFeedback } from '../types/feedback';

export function computeFieldFeedback(
  guessVal: string | number | undefined,
  targetVal: string | number | undefined,
  attribute: Attribute,
): FieldFeedback {
  const { type, order } = attribute;

  // Handle boolean type first (before falsy checks that would break boolean false)
  if (type === AttributeType.Boolean) {
    const gBool = guessVal === true || guessVal === "true" || String(guessVal).toLowerCase() === "true";
    const tBool = targetVal === true || targetVal === "true" || String(targetVal).toLowerCase() === "true";

    if (gBool === tBool) {
      return { type: FeedbackType.Correct, label: gBool ? "oui" : "non" };
    }
    return { type: FeedbackType.Wrong, label: gBool ? "oui" : "non" };
  }

  const gLower = guessVal !== null && guessVal !== undefined ? guessVal.toString().toLowerCase() : null;
  const tLower = targetVal !== null && targetVal !== undefined ? targetVal.toString().toLowerCase() : null;

  if (gLower && tLower && gLower === tLower) {
    return { type: FeedbackType.Correct, label: String(guessVal) };
  }

  const gIsUnknown = !gLower || gLower === "unknown";
  const tIsUnknown = !tLower || tLower === "unknown";

  if (gIsUnknown || tIsUnknown) {
    return { type: FeedbackType.Wrong, label: String(guessVal ?? '-') };
  }

  if (type === AttributeType.Number) {
    const g = Number(guessVal);
    const t = Number(targetVal);
    if (isNaN(g) || isNaN(t)) return { type: FeedbackType.Wrong, label: String(guessVal) };
    if (g === t) return { type: FeedbackType.Correct, label: String(guessVal) };
    if (g > t) return { type: FeedbackType.Higher, label: String(guessVal) };
    return { type: FeedbackType.Lower, label: String(guessVal) };
  }

  if (type === AttributeType.Ordered && order) {
    const guessIndex = order.findIndex(item =>
      gLower.includes(item.toLowerCase()) || item.toLowerCase().includes(gLower)
    );
    const targetIndex = order.findIndex(item =>
      tLower.includes(item.toLowerCase()) || item.toLowerCase().includes(tLower)
    );
    if (guessIndex === -1 || targetIndex === -1) return { type: FeedbackType.Wrong, label: String(guessVal) };
    if (guessIndex === targetIndex) return { type: FeedbackType.Correct, label: String(guessVal) };
    if (guessIndex > targetIndex) return { type: FeedbackType.Higher, label: String(guessVal) };
    return { type: FeedbackType.Lower, label: String(guessVal) };
  }

  if (type === AttributeType.Multi) {
    const gSet = new Set(guessVal?.toString().toLowerCase().split(",").map(v => v.trim()));
    const tSet = new Set(targetVal?.toString().toLowerCase().split(",").map(v => v.trim()));
    const hasOverlap = [...gSet].some(v => tSet.has(v));
    if (hasOverlap) {
      const isExact = gSet.size === tSet.size && [...gSet].every(v => tSet.has(v));
      return isExact
        ? { type: FeedbackType.Correct, label: String(guessVal) }
        : { type: FeedbackType.Close, label: String(guessVal) };
    }
    return { type: FeedbackType.Wrong, label: String(guessVal) };
  }

  return { type: FeedbackType.Wrong, label: String(guessVal) };
}

export function getFeedbackObject(
  guess: Record<string, string | number>,
  target: Record<string, string | number>,
  attributes: Attribute[],
): Record<string, FieldFeedback> {
  const obj: Record<string, FieldFeedback> = {};
  attributes.forEach(attr => {
    obj[attr.key] = computeFieldFeedback(guess[attr.key], target[attr.key], attr);
  });
  return obj;
}
