import { FeedbackType } from '../constants/enums';
import type { Character } from './anime';

export interface FieldFeedback {
  type: FeedbackType;
  label: string;
}

export interface AttemptEntry {
  guess: Character;
  feedback: Record<string, FieldFeedback>;
  isCorrect: boolean;
}
