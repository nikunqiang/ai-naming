// src/lib/__tests__/popularity.test.ts
import { describe, it, expect } from 'vitest'
import { analyzeNamePopularity } from '../popularity'

describe('analyzeNamePopularity', () => {
  it('returns 极高 level for very common name (子轩)', () => {
    const result = analyzeNamePopularity('子轩')
    expect(result.level).toBe('极高')
    expect(result.score).toBeLessThanOrEqual(2)
  })

  it('returns 极低 level for rare name (彧翀)', () => {
    const result = analyzeNamePopularity('彧翀')
    expect(result.level).toBe('极低')
    expect(result.score).toBeGreaterThanOrEqual(4)
  })

  it('returns score between 0 and 5', () => {
    const result = analyzeNamePopularity('子轩')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(5)
  })
})
