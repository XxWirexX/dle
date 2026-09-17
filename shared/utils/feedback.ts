import type { Attribute, AttributeValue, FieldFeedback, Character, GuessFeedback } from '#shared/types/game'

function toDisplayLabel(value: AttributeValue): string {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function computeMultipleFeedback(guessVal: AttributeValue, targetVal: AttributeValue): FieldFeedback {
  const gArray = Array.isArray(guessVal) ? guessVal : []
  const tArray = Array.isArray(targetVal) ? targetVal : []
  const gSet = new Set(gArray.map((v) => v.toLowerCase()))
  const tSet = new Set(tArray.map((v) => v.toLowerCase()))

  const label = gArray.length > 0 ? gArray.join(', ') : 'Aucun'

  if (gSet.size === 0 && tSet.size === 0) return { type: 'correct', label }
  if (gSet.size === 0 || tSet.size === 0) return { type: 'wrong', label }

  const sameSet = gSet.size === tSet.size && [...gSet].every((v) => tSet.has(v))
  if (sameSet) return { type: 'correct', label }

  const hasCommon = [...gSet].some((v) => tSet.has(v))
  return hasCommon ? { type: 'close', label } : { type: 'wrong', label }
}

function toBool(value: AttributeValue): boolean {
  return value === true || value === 'true' || String(value).toLowerCase() === 'true'
}

function computeBooleanFeedback(guessVal: AttributeValue, targetVal: AttributeValue): FieldFeedback {
  const gBool = toBool(guessVal)
  const tBool = toBool(targetVal)
  const label = gBool ? 'Oui' : 'Non'
  return gBool === tBool ? { type: 'correct', label } : { type: 'wrong', label }
}

function computeNumberFeedback(guessVal: AttributeValue, targetVal: AttributeValue): FieldFeedback {
  const g = Number(guessVal)
  const t = Number(targetVal)
  const label = toDisplayLabel(guessVal)

  if (Number.isNaN(g) || Number.isNaN(t)) return { type: 'wrong', label }
  if (g === t) return { type: 'correct', label }
  if (Math.abs(g - t) === 1) return { type: 'close', label, direction: g > t ? 'higher' : 'lower' }
  return g > t ? { type: 'higher', label } : { type: 'lower', label }
}

function computeOrderedFeedback(guessVal: AttributeValue, targetVal: AttributeValue, order: string[]): FieldFeedback {
  const gLower = String(guessVal ?? '').toLowerCase()
  const tLower = String(targetVal ?? '').toLowerCase()
  const label = toDisplayLabel(guessVal)

  const guessIndex = order.findIndex((item) => item.toLowerCase() === gLower)
  const targetIndex = order.findIndex((item) => item.toLowerCase() === tLower)

  if (guessIndex === -1 || targetIndex === -1) return { type: 'wrong', label }
  if (guessIndex === targetIndex) return { type: 'correct', label }
  if (Math.abs(guessIndex - targetIndex) === 1) {
    return { type: 'close', label, direction: guessIndex > targetIndex ? 'higher' : 'lower' }
  }
  return guessIndex > targetIndex ? { type: 'higher', label } : { type: 'lower', label }
}

function computeTextFeedback(guessVal: AttributeValue, targetVal: AttributeValue, groups?: string[][]): FieldFeedback {
  const gLower = String(guessVal ?? '').toLowerCase()
  const tLower = String(targetVal ?? '').toLowerCase()
  const label = toDisplayLabel(guessVal)

  if (groups) {
    for (const group of groups) {
      const groupLower = group.map((g) => g.toLowerCase())
      const gInGroup = groupLower.some((item) => gLower.includes(item) || item.includes(gLower))
      const tInGroup = groupLower.some((item) => tLower.includes(item) || item.includes(tLower))
      if (gInGroup && tInGroup) return { type: 'close', label }
    }
  }

  // "female" contient "male" mais ce n'est pas une correspondance partielle voulue.
  const isMaleFemale = (gLower === 'male' && tLower === 'female') || (gLower === 'female' && tLower === 'male')
  if (!isMaleFemale && (tLower.includes(gLower) || gLower.includes(tLower))) {
    return { type: 'close', label }
  }

  return { type: 'wrong', label }
}

export function computeFieldFeedback(guessVal: AttributeValue, targetVal: AttributeValue, attribute: Attribute): FieldFeedback {
  const { type, order, groups } = attribute

  if (type === 'multiple') return computeMultipleFeedback(guessVal, targetVal)
  if (type === 'boolean') return computeBooleanFeedback(guessVal, targetVal)

  const gLower = guessVal !== null && guessVal !== undefined && guessVal !== '' ? String(guessVal).toLowerCase() : null
  const tLower = targetVal !== null && targetVal !== undefined && targetVal !== '' ? String(targetVal).toLowerCase() : null

  // Égalité stricte (y compris "unknown" === "unknown") : toujours correct,
  // avant même de vérifier si l'une des deux valeurs est inconnue.
  if (gLower && tLower && gLower === tLower) {
    return { type: 'correct', label: toDisplayLabel(guessVal) }
  }

  const gIsUnknown = !gLower || gLower === 'unknown'
  const tIsUnknown = !tLower || tLower === 'unknown'

  if (type === 'ordered' && order) {
    const unknownInOrder = order.some((item) => item.toLowerCase() === 'unknown')
    if (!unknownInOrder && (gIsUnknown || tIsUnknown)) {
      return { type: 'wrong', label: toDisplayLabel(guessVal) }
    }
  } else if (gIsUnknown || tIsUnknown) {
    return { type: 'wrong', label: toDisplayLabel(guessVal) }
  }

  if (type === 'number') return computeNumberFeedback(guessVal, targetVal)
  if (type === 'ordered' && order) return computeOrderedFeedback(guessVal, targetVal, order)

  return computeTextFeedback(guessVal, targetVal, type === 'text-group' ? groups : undefined)
}

export function computeGuessFeedback(guess: Character, target: Character, attributes: Attribute[]): GuessFeedback {
  const result: GuessFeedback = {}
  for (const attr of attributes) {
    result[attr.key] = computeFieldFeedback(guess.attributes[attr.key], target.attributes[attr.key], attr)
  }
  return result
}
