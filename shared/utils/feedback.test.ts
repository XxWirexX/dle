import { describe, it, expect } from 'vitest'
import { computeFieldFeedback, computeGuessFeedback } from './feedback'
import type { Attribute, Character } from '#shared/types/game'

describe('computeFieldFeedback — text', () => {
  const attr: Attribute = { key: 'gender', label: 'Gender', type: 'text' }

  it('correct on exact match (case-insensitive)', () => {
    expect(computeFieldFeedback('Male', 'male', attr).type).toBe('correct')
  })

  it('close when one contains the other', () => {
    const a: Attribute = { key: 'aff', label: 'Affiliation', type: 'text' }
    expect(computeFieldFeedback('Straw Hat', 'Straw Hat Pirates', a).type).toBe('close')
  })

  it('wrong on unrelated values', () => {
    expect(computeFieldFeedback('Male', 'Female', attr).type).toBe('wrong')
  })

  it('male/female are never a partial match despite substring overlap', () => {
    expect(computeFieldFeedback('Male', 'Female', attr).type).toBe('wrong')
    expect(computeFieldFeedback('Female', 'Male', attr).type).toBe('wrong')
  })

  it('wrong when either side is unknown/empty', () => {
    expect(computeFieldFeedback('Unknown', 'Male', attr).type).toBe('wrong')
    expect(computeFieldFeedback(null, 'Male', attr).type).toBe('wrong')
  })

  it('correct when both sides are "unknown"', () => {
    expect(computeFieldFeedback('Unknown', 'Unknown', attr).type).toBe('correct')
  })
})

describe('computeFieldFeedback — number', () => {
  const attr: Attribute = { key: 'age', label: 'Age', type: 'number' }

  it('correct on equal value', () => {
    expect(computeFieldFeedback(25, 25, attr).type).toBe('correct')
  })

  it('close with direction when off by exactly one', () => {
    const higher = computeFieldFeedback(26, 25, attr)
    expect(higher).toMatchObject({ type: 'close', direction: 'higher' })
    const lower = computeFieldFeedback(24, 25, attr)
    expect(lower).toMatchObject({ type: 'close', direction: 'lower' })
  })

  it('higher/lower beyond one', () => {
    expect(computeFieldFeedback(30, 25, attr).type).toBe('higher')
    expect(computeFieldFeedback(20, 25, attr).type).toBe('lower')
  })

  it('wrong when not a number', () => {
    expect(computeFieldFeedback('abc', 25, attr).type).toBe('wrong')
  })
})

describe('computeFieldFeedback — ordered', () => {
  const attr: Attribute = {
    key: 'rank', label: 'Rank', type: 'ordered',
    order: ['Unknown', 'Third Class', 'Second Class', 'First Class', 'Great Mage'],
  }

  it('correct on same position', () => {
    expect(computeFieldFeedback('First Class', 'First Class', attr).type).toBe('correct')
  })

  it('close with direction when adjacent', () => {
    expect(computeFieldFeedback('First Class', 'Second Class', attr))
      .toMatchObject({ type: 'close', direction: 'higher' })
    expect(computeFieldFeedback('Second Class', 'First Class', attr))
      .toMatchObject({ type: 'close', direction: 'lower' })
  })

  it('higher/lower beyond adjacent', () => {
    expect(computeFieldFeedback('Great Mage', 'Third Class', attr).type).toBe('higher')
    expect(computeFieldFeedback('Third Class', 'Great Mage', attr).type).toBe('lower')
  })

  it('"unknown" is a real position when present in the order list', () => {
    expect(computeFieldFeedback('Unknown', 'Third Class', attr))
      .toMatchObject({ type: 'close', direction: 'lower' })
  })

  it('wrong when value is not part of the order list', () => {
    expect(computeFieldFeedback('Not A Rank', 'First Class', attr).type).toBe('wrong')
  })
})

describe('computeFieldFeedback — multiple', () => {
  const attr: Attribute = { key: 'haki', label: 'Haki', type: 'multiple' }

  it('correct on identical sets regardless of order', () => {
    expect(computeFieldFeedback(['Armament', 'Observation'], ['Observation', 'Armament'], attr).type).toBe('correct')
  })

  it('correct when both empty', () => {
    expect(computeFieldFeedback([], [], attr).type).toBe('correct')
  })

  it('close on partial overlap', () => {
    expect(computeFieldFeedback(['Armament'], ['Armament', 'Conqueror'], attr).type).toBe('close')
  })

  it('wrong on no overlap', () => {
    expect(computeFieldFeedback(['Armament'], ['Conqueror'], attr).type).toBe('wrong')
  })

  it('wrong when only one side is empty', () => {
    expect(computeFieldFeedback([], ['Armament'], attr).type).toBe('wrong')
  })
})

describe('computeFieldFeedback — text-group', () => {
  const attr: Attribute = {
    key: 'affiliation', label: 'Affiliation', type: 'text-group',
    groups: [['Straw Hat Pirates', 'Straw Hats'], ['Marines', 'World Government']],
  }

  it('close when both values belong to the same group', () => {
    expect(computeFieldFeedback('Straw Hats', 'Straw Hat Pirates', attr).type).toBe('close')
  })

  it('falls back to text matching outside of groups', () => {
    expect(computeFieldFeedback('Marines', 'World Government', attr).type).toBe('close')
  })

  it('wrong across unrelated groups', () => {
    expect(computeFieldFeedback('Marines', 'Straw Hat Pirates', attr).type).toBe('wrong')
  })
})

describe('computeFieldFeedback — boolean', () => {
  const attr: Attribute = { key: 'starryEyes', label: 'Starry Eyes', type: 'boolean' }

  it('correct when both true', () => {
    expect(computeFieldFeedback(true, true, attr)).toMatchObject({ type: 'correct', label: 'Oui' })
  })

  it('correct when both false — label reflects the guess, not a hardcoded "oui"', () => {
    expect(computeFieldFeedback(false, false, attr)).toMatchObject({ type: 'correct', label: 'Non' })
  })

  it('wrong on mismatch', () => {
    expect(computeFieldFeedback(true, false, attr)).toMatchObject({ type: 'wrong', label: 'Oui' })
  })

  it('accepts string "true"/"false" as well as real booleans', () => {
    expect(computeFieldFeedback('true', true, attr).type).toBe('correct')
  })
})

describe('computeGuessFeedback', () => {
  const attributes: Attribute[] = [
    { key: 'gender', label: 'Gender', type: 'text' },
    { key: 'age', label: 'Age', type: 'number' },
  ]
  const target: Character = { id: 1, name: 'Luffy', imageUrl: '', attributes: { gender: 'Male', age: 19 } }
  const guess: Character = { id: 2, name: 'Zoro', imageUrl: '', attributes: { gender: 'Male', age: 21 } }

  it('computes feedback for every attribute', () => {
    const result = computeGuessFeedback(guess, target, attributes)
    expect(result.gender?.type).toBe('correct')
    expect(result.age).toMatchObject({ type: 'higher' })
  })
})
