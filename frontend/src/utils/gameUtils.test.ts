import { describe, it, expect } from 'vitest';
import { pickTarget, generateShareText } from './gameUtils';
import { FeedbackType, AttributeType } from '../constants/enums';
import type { Character, Attribute } from '../types/anime';
import type { AttemptEntry } from '../types/feedback';

const chars: Character[] = [
  { id: '1', name: 'A', image: 'a.png' },
  { id: '2', name: 'B', image: 'b.png' },
  { id: '3', name: 'C', image: 'c.png' },
];

const attr: Attribute = { key: 'name', label: 'Name', type: AttributeType.Text };

describe('pickTarget', () => {
  it('returns a character from the list', () => {
    const result = pickTarget(chars);
    expect(chars).toContain(result);
  });
});

describe('generateShareText', () => {
  it('shows X when lost', () => {
    const attempts: AttemptEntry[] = [
      { guess: chars[0], feedback: { name: { type: FeedbackType.Wrong, label: 'A' } }, isCorrect: false },
    ];
    const text = generateShareText(attempts, [attr], 'TestGame', 1, 10);
    expect(text).toContain('X/10');
  });

  it('shows count when won', () => {
    const attempts: AttemptEntry[] = [
      { guess: chars[0], feedback: { name: { type: FeedbackType.Correct, label: 'A' } }, isCorrect: true },
    ];
    const text = generateShareText(attempts, [attr], 'TestGame', 5, 10);
    expect(text).toContain('1/10');
    expect(text).toContain('#5');
  });

  it('uses 🟩 for correct', () => {
    const attempts: AttemptEntry[] = [
      { guess: chars[0], feedback: { name: { type: FeedbackType.Correct, label: 'A' } }, isCorrect: true },
    ];
    const text = generateShareText(attempts, [attr], 'TestGame', 1, 10);
    expect(text).toContain('🟩');
  });

  it('uses 🟨 for close', () => {
    const attempts: AttemptEntry[] = [
      { guess: chars[0], feedback: { name: { type: FeedbackType.Close, label: 'A' } }, isCorrect: false },
    ];
    const text = generateShareText(attempts, [attr], 'TestGame', 1, 10);
    expect(text).toContain('🟨');
  });
});
