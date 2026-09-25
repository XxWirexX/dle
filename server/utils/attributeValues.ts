import type { AttributeType } from '#shared/types/game'

export interface AttributeLike {
  label: string
  type: AttributeType
  order?: string[] | null
}

// Partagé entre la création de DLE custom et l'édition admin d'un jeu
// existant : un personnage n'a pas le droit d'avoir une valeur qui ne
// correspond pas au type déclaré de l'attribut, quel que soit le point
// d'entrée qui l'écrit.
export function coerceAttributeValue(attr: AttributeLike, raw: unknown): unknown {
  if (attr.type === 'number') {
    const n = Number(raw)
    if (Number.isNaN(n)) throw createError({ statusCode: 400, message: `Valeur numérique invalide pour "${attr.label}"` })
    return n
  }
  if (attr.type === 'boolean') return raw === true || raw === 'true'
  if (attr.type === 'multiple') {
    if (!Array.isArray(raw)) throw createError({ statusCode: 400, message: `Valeur invalide pour "${attr.label}" (liste attendue)` })
    return raw.map((v) => String(v).trim()).filter(Boolean)
  }
  if (attr.type === 'ordered') {
    const value = String(raw ?? '').trim()
    const valid = (attr.order ?? []).some((o) => o.toLowerCase() === value.toLowerCase())
    if (!valid) throw createError({ statusCode: 400, message: `"${value}" n'est pas une valeur déclarée pour "${attr.label}"` })
    return value
  }
  return String(raw ?? '').trim()
}
