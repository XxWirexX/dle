import type { Attribute, Character } from './anime';

export type Visibility = 'private' | 'unlisted' | 'public';

export interface CustomDleListItem {
  id: string;
  name: string;
  iconUrl: string | null;
  backgroundUrl: string | null;
  maxAttempts: number;
  visibility: Visibility;
  characterCount: number;
  attributeCount: number;
  createdAt: string;
  ownerUsername?: string | null;
}

export interface CustomDleGame {
  id: string;
  name: string;
  icon: string | null;
  background: string | null;
  maxAttempts: number;
  attributes: Attribute[];
  characters: CustomCharacter[];
  visibility: Visibility;
  ownerId: number;
  isCustom: true;
}

export interface CustomCharacter extends Character {
  imagePublicId?: string;
}

export interface CreateCustomDlePayload {
  name: string;
  iconUrl: string | null;
  iconPublicId: string | null;
  backgroundUrl: string | null;
  backgroundPublicId: string | null;
  maxAttempts: number;
  attributes: Attribute[];
  characters: CustomCharacter[];
  visibility: Visibility;
}

export interface CustomDleDetail {
  id: string;
  name: string;
  iconUrl: string | null;
  backgroundUrl: string | null;
  maxAttempts: number;
  visibility: Visibility;
  attributes: Attribute[];
  characterCount: number;
  attributeCount: number;
  characters: Array<{ id: string; name: string; image: string }>;
  ownerId: number;
  ownerUsername: string | null;
  isOwner: boolean;
  isCustom: true;
}
