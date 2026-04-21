import { FeedbackType } from '../constants/enums';
import type { Character, Attribute } from '../types/anime';
import type { AttemptEntry } from '../types/feedback';

export function pickTarget(list: Character[]): Character {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateShareText(
  attempts: AttemptEntry[],
  attributes: Attribute[],
  gameName: string,
  dayNumber: number,
  maxAttempts: number,
): string {
  const isWon = attempts.some(a => a.isCorrect);
  const count = isWon ? attempts.length : 'X';
  const grid = [...attempts].reverse().map(attempt =>
    attributes.map(attr => {
      const fb = attempt.feedback[attr.key];
      if (fb?.type === FeedbackType.Correct) return '🟩';
      if (fb?.type === FeedbackType.Close) return '🟨';
      return '⬛';
    }).join('')
  ).join('\n');
  return `Mangadle - ${gameName} #${dayNumber}\n${count}/${maxAttempts}\n\n${grid}`;
}
