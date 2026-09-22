export type AttributeType = 'text' | 'number' | 'ordered' | 'multiple' | 'text-group' | 'boolean'

export interface Attribute {
  key: string
  label: string
  type: AttributeType
  order?: string[]
  hints?: string[]
  groups?: string[][]
}

export type AttributeValue = string | number | boolean | string[] | null | undefined

export interface Character {
  id: number
  name: string
  imageUrl: string
  attributes: Record<string, AttributeValue>
}

export type FeedbackType = 'correct' | 'wrong' | 'higher' | 'lower' | 'close'

export interface FieldFeedback {
  type: FeedbackType
  label: string
  direction?: 'higher' | 'lower'
}

export type GuessFeedback = Record<string, FieldFeedback>

export interface GameSummary {
  id: number
  slug: string
  name: string
  iconUrl: string | null
  backgroundUrl: string | null
  maxAttempts: number
  characterCount: number
  attributeCount: number
}

export type GameVisibility = 'public' | 'private'

export interface OwnedGameSummary extends GameSummary {
  visibility: GameVisibility
}

export interface GameDetail extends GameSummary {
  attributes: Attribute[]
  characterPreview: Pick<Character, 'id' | 'name' | 'imageUrl'>[]
}

export interface GamePlayData {
  id: number
  slug: string
  name: string
  backgroundUrl: string | null
  maxAttempts: number
  attributes: Attribute[]
  characters: Character[]
}
