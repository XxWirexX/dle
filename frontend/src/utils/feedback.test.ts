import { describe, it, expect } from 'vitest';
import { computeFieldFeedback, getFeedbackObject } from './feedback';
import { FeedbackType, AttributeType } from '../constants/enums';
import type { Attribute } from '../types/anime';

const numAttr: Attribute = { key: 'power', label: 'Power', type: AttributeType.Number };
const textAttr: Attribute = { key: 'name', label: 'Name', type: AttributeType.Text };
const ordAttr: Attribute = { key: 'arc', label: 'Arc', type: AttributeType.Ordered, order: ['Arco1', 'Arco2', 'Arco3'] };
const multiAttr: Attribute = { key: 'tags', label: 'Tags', type: AttributeType.Multi };

describe('computeFieldFeedback', () => {
  it('returns correct when values match (text)', () => {
    const result = computeFieldFeedback('Fire', 'Fire', textAttr);
    expect(result.type).toBe(FeedbackType.Correct);
  });

  it('returns correct case-insensitive', () => {
    const result = computeFieldFeedback('fire', 'Fire', textAttr);
    expect(result.type).toBe(FeedbackType.Correct);
  });

  it('returns wrong when text values differ', () => {
    const result = computeFieldFeedback('Fire', 'Water', textAttr);
    expect(result.type).toBe(FeedbackType.Wrong);
  });

  it('returns higher when guess > target for number', () => {
    const result = computeFieldFeedback(10, 5, numAttr);
    expect(result.type).toBe(FeedbackType.Higher);
  });

  it('returns lower when guess < target for number', () => {
    const result = computeFieldFeedback(3, 8, numAttr);
    expect(result.type).toBe(FeedbackType.Lower);
  });

  it('returns correct when numbers match exactly', () => {
    const result = computeFieldFeedback(5, 5, numAttr);
    expect(result.type).toBe(FeedbackType.Correct);
  });

  it('returns wrong for unknown values', () => {
    const result = computeFieldFeedback('unknown', 'Fire', textAttr);
    expect(result.type).toBe(FeedbackType.Wrong);
  });

  it('returns correct for ordered match', () => {
    const result = computeFieldFeedback('Arco2', 'Arco2', ordAttr);
    expect(result.type).toBe(FeedbackType.Correct);
  });

  it('returns higher for ordered guess after target', () => {
    const result = computeFieldFeedback('Arco3', 'Arco1', ordAttr);
    expect(result.type).toBe(FeedbackType.Higher);
  });

  it('returns lower for ordered guess before target', () => {
    const result = computeFieldFeedback('Arco1', 'Arco3', ordAttr);
    expect(result.type).toBe(FeedbackType.Lower);
  });

  it('returns close for partial multi match', () => {
    const result = computeFieldFeedback('a, b', 'a, c', multiAttr);
    expect(result.type).toBe(FeedbackType.Close);
  });

  it('returns correct for exact multi match', () => {
    const result = computeFieldFeedback('a, b', 'a, b', multiAttr);
    expect(result.type).toBe(FeedbackType.Correct);
  });

  it('returns wrong for no multi overlap', () => {
    const result = computeFieldFeedback('a, b', 'c, d', multiAttr);
    expect(result.type).toBe(FeedbackType.Wrong);
  });
});

describe('getFeedbackObject', () => {
  it('returns feedback for each attribute', () => {
    const guess = { power: 10 };
    const target = { power: 5 };
    const result = getFeedbackObject(guess, target, [numAttr]);
    expect(result.power.type).toBe(FeedbackType.Higher);
  });
});
