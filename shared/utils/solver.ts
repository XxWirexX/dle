import type { Attribute, Character } from '#shared/types/game'
import { computeGuessFeedback } from './feedback'

// Un "motif" encode, pour un guess donné, la réponse exacte que le joueur
// verrait pour une cible donnée — type + direction (l'étiquette ne compte
// pas : elle vaut toujours la valeur du GUESS, donc elle ne varie jamais
// d'une cible à l'autre pour un même guess, inutile pour regrouper).
function patternKey(guess: Character, target: Character, attributes: Attribute[]): string {
  const feedback = computeGuessFeedback(guess, target, attributes)
  return attributes.map((a) => {
    const f = feedback[a.key]!
    return f.direction ? `${f.type}:${f.direction}` : f.type
  }).join('|')
}

export interface OpenerStats {
  id: number
  name: string
  distinctPatterns: number
  worstCaseBucket: number
  expectedRemaining: number
  entropyBits: number
}

/** Classement de tous les personnages comme guess d'ouverture — O(n²). */
export function computeOpenerStats(characters: Character[], attributes: Attribute[]): OpenerStats[] {
  const n = characters.length
  return characters.map((guess) => {
    const buckets = new Map<string, number>()
    for (const target of characters) {
      const key = patternKey(guess, target, attributes)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    const sizes = [...buckets.values()]
    const expectedRemaining = sizes.reduce((sum, s) => sum + (s / n) * s, 0)
    const entropyBits = -sizes.reduce((sum, s) => sum + (s / n) * Math.log2(s / n), 0)
    return {
      id: guess.id,
      name: guess.name,
      distinctPatterns: buckets.size,
      worstCaseBucket: Math.max(...sizes),
      expectedRemaining,
      entropyBits,
    }
  }).sort((a, b) => a.expectedRemaining - b.expectedRemaining || b.entropyBits - a.entropyBits)
}

interface GuessChoice {
  guess: Character
  expectedRemaining: number
}

// Cherche, parmi les personnages pas encore tentés, celui qui minimise le
// nombre de candidats restants en moyenne sur `pool`. À égalité, préfère un
// guess qui fait encore partie de `pool` (il peut gagner tout de suite),
// plutôt qu'un guess déjà éliminé qui ne sert qu'à trier sans jamais gagner.
function bestGuessForPool(pool: Character[], allCharacters: Character[], excludeIds: Set<number>, attributes: Attribute[]): GuessChoice {
  const poolIds = new Set(pool.map((c) => c.id))
  let best: GuessChoice & { inPool: boolean } | null = null
  for (const guess of allCharacters) {
    if (excludeIds.has(guess.id)) continue
    const buckets = new Map<string, number>()
    for (const target of pool) {
      const key = patternKey(guess, target, attributes)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    const n = pool.length
    const expectedRemaining = [...buckets.values()].reduce((sum, s) => sum + (s / n) * s, 0)
    const inPool = poolIds.has(guess.id)
    if (
      !best ||
      expectedRemaining < best.expectedRemaining - 1e-9 ||
      (Math.abs(expectedRemaining - best.expectedRemaining) < 1e-9 && inPool && !best.inPool)
    ) {
      best = { guess, expectedRemaining, inPool }
    }
  }
  return best!
}

export interface SolverBranchCell {
  attrKey: string
  attrLabel: string
  type: string
  direction?: 'higher' | 'lower'
}

export interface SolverBranch {
  cells: SolverBranchCell[]
  poolSize: number
  solvedCharacterName?: string // défini quand poolSize === 1 : plus qu'à deviner ce nom
  // Défini quand plusieurs personnages restent mais sont strictement
  // indiscernables l'un de l'autre sur TOUS les attributs du jeu — aucun
  // guess, même ailleurs dans tout le roster, ne peut jamais les séparer
  // (voir le trio "Esrest" dans L'Atelier des Sorciers). Pas la peine
  // d'essayer d'autres guess : il faut deviner au hasard parmi ceux-ci.
  tiedCharacterNames?: string[]
  next?: SolverTreeNode // absent si feuille, impasse indiscernable, ou profondeur/budget atteint
}

export interface SolverTreeNode {
  guessId: number
  guessName: string
  guessImageUrl: string
  poolSize: number
  expectedRemaining: number
  branches: SolverBranch[]
  truncated: boolean // true si une branche aurait pu continuer mais la profondeur/le budget a coupé court
}

export interface BuildTreeOptions {
  maxDepth: number
  maxNodes: number
  // Budget en millisecondes, indépendant de maxNodes : le coût d'UN SEUL
  // nœud grandit avec le nombre de personnages du jeu (recherche O(n²)), donc
  // un plafond sur le nombre de nœuds ne suffit pas à borner le temps total
  // pour un très gros jeu — un seul nœud coûteux peut à lui seul dépasser
  // ce budget. Vérifié aux mêmes points que maxNodes.
  maxTimeMs: number
  rootCharacterId?: number
  // Appelé entre deux nœuds pour rendre la main à la boucle d'événements —
  // sans ça, un arbre un peu profond bloquerait tout le process Node le
  // temps du calcul, gelant le site entier (pas seulement cette requête).
  onYield?: () => Promise<void>
}

export interface BuildTreeResult {
  tree: SolverTreeNode
  nodesComputed: number
  budgetExceeded: boolean
}

export async function buildSolverTree(
  characters: Character[],
  attributes: Attribute[],
  opts: BuildTreeOptions,
): Promise<BuildTreeResult> {
  let nodesComputed = 0
  let budgetExceeded = false
  const startedAt = Date.now()
  const isOverBudget = () => nodesComputed >= opts.maxNodes || Date.now() - startedAt >= opts.maxTimeMs

  async function build(pool: Character[], excludeIds: Set<number>, depth: number, forcedGuessId?: number): Promise<SolverTreeNode> {
    nodesComputed++
    if (opts.onYield && nodesComputed % 15 === 0) await opts.onYield()

    const guess = forcedGuessId
      ? characters.find((c) => c.id === forcedGuessId)!
      : bestGuessForPool(pool, characters, excludeIds, attributes).guess
    const newExclude = new Set(excludeIds)
    newExclude.add(guess.id)

    const buckets = new Map<string, Character[]>()
    for (const target of pool) {
      const key = patternKey(guess, target, attributes)
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(target)
    }

    const n = pool.length
    const expectedRemaining = [...buckets.values()].reduce((sum, list) => sum + (list.length / n) * list.length, 0)

    const sortedBuckets = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)
    const branches: SolverBranch[] = []
    let truncated = false

    for (const [key, list] of sortedBuckets) {
      const cells: SolverBranchCell[] = attributes.map((a, i) => {
        const [type, direction] = key.split('|')[i]!.split(':')
        return { attrKey: a.key, attrLabel: a.label, type: type!, direction: direction as 'higher' | 'lower' | undefined }
      })

      if (list.length === 1) {
        branches.push({ cells, poolSize: 1, solvedCharacterName: list[0]!.name })
        continue
      }

      if (depth + 1 >= opts.maxDepth || isOverBudget()) {
        branches.push({ cells, poolSize: list.length })
        truncated = true
        if (isOverBudget()) budgetExceeded = true
        continue
      }

      const child = await build(list, newExclude, depth + 1)
      // Le meilleur guess possible (cherché sur tout le roster) n'a quand
      // même produit qu'un seul motif pour ce pool : aucun guess ne peut
      // jamais les séparer, inutile de représenter un nœud récursif — ils
      // sont indiscernables, le solveur n'a plus rien à proposer ici.
      const isDeadEnd = child.branches.length === 1 && child.branches[0]!.poolSize === list.length
      if (isDeadEnd) {
        branches.push({ cells, poolSize: list.length, tiedCharacterNames: list.map((c) => c.name) })
      } else {
        branches.push({ cells, poolSize: list.length, next: child })
      }
    }

    return {
      guessId: guess.id,
      guessName: guess.name,
      guessImageUrl: guess.imageUrl,
      poolSize: n,
      expectedRemaining,
      branches,
      truncated,
    }
  }

  const tree = await build(characters, new Set(), 0, opts.rootCharacterId)
  return { tree, nodesComputed, budgetExceeded }
}
