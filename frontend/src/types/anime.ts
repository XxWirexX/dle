import { AttributeType } from '../constants/enums';

export interface AnimeListItem {
  id: string;
  name: string;
  icon: string;
  background: string;
  maxAttempts: number;
  characterCount: number;
  attributeCount: number;
}

export interface Attribute {
  key: string;
  label: string;
  type: AttributeType;
  order?: string[];
  options?: string[];
  hints?: string[];
}

export interface Character {
  id: string;
  name: string;
  image: string;
  [key: string]: string | number;
}

export interface AnimeGame {
  id: string;
  name: string;
  background: string;
  maxAttempts: number;
  attributes: Attribute[];
  characters: Character[];
}

export interface AvatarCharacter {
  id: string;
  name: string;
  image: string;
}

export interface AvatarGroup {
  animeId: string;
  animeName: string;
  characters: AvatarCharacter[];
}
