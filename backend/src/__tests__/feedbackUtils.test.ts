import { computeFieldFeedback, getFeedbackObject } from '../socket/feedbackUtils';

describe('computeFieldFeedback', () => {
  it('returns correct when values match exactly', () => {
    const result = computeFieldFeedback('Fire', 'Fire', { type: 'text' });
    expect(result.type).toBe('correct');
  });

  it('returns correct case-insensitive for text', () => {
    const result = computeFieldFeedback('fire', 'Fire', { type: 'text' });
    expect(result.type).toBe('correct');
  });

  it('returns wrong for unknown guess', () => {
    const result = computeFieldFeedback('unknown', 'Fire', { type: 'text' });
    expect(result.type).toBe('wrong');
  });

  it('returns higher when guess > target (number)', () => {
    const result = computeFieldFeedback(10, 5, { type: 'number' });
    expect(result.type).toBe('higher');
  });

  it('returns lower when guess < target (number)', () => {
    const result = computeFieldFeedback(3, 8, { type: 'number' });
    expect(result.type).toBe('lower');
  });

  it('returns correct for exact number match', () => {
    const result = computeFieldFeedback(5, 5, { type: 'number' });
    expect(result.type).toBe('correct');
  });
});

describe('getFeedbackObject', () => {
  it('computes feedback for each attribute', () => {
    const guess = { power: 10 };
    const target = { power: 5 };
    const attrs = [{ key: 'power', type: 'number' }];
    const result = getFeedbackObject(guess, target, attrs);
    expect(result.power.type).toBe('higher');
  });
});
