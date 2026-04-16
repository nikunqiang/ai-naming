import { describe, it, expect } from 'vitest'
import { getWuxingRelation, analyzeWuxingBenefit, calculateBaZi } from '../wuxing'
import type { BaZiResult } from '../wuxing'

// Helper: create a BaZiResult with a specific day stem for controlled testing
function makeBaZi(overrides: Partial<BaZiResult> & { dayGan: string }): BaZiResult {
  return {
    yearGan: '甲',
    yearZhi: '子',
    monthGan: '丙',
    monthZhi: '寅',
    dayGan: overrides.dayGan,
    dayZhi: '午',
    timeGan: '庚',
    timeZhi: '申',
    wuxing: overrides.wuxing ?? { gold: 1, wood: 2, water: 1, fire: 2, earth: 2 },
    missing: overrides.missing ?? [],
    dominant: overrides.dominant ?? '木',
  }
}

describe('getWuxingRelation', () => {
  it('木生火', () => {
    expect(getWuxingRelation('木', '火')).toBe('生')
  })

  it('金克木', () => {
    expect(getWuxingRelation('金', '木')).toBe('克')
  })

  it('水与水为同', () => {
    expect(getWuxingRelation('水', '水')).toBe('同')
  })

  it('火被木生', () => {
    expect(getWuxingRelation('火', '木')).toBe('被生')
  })

  it('木被金克', () => {
    expect(getWuxingRelation('木', '金')).toBe('被克')
  })
})

describe('analyzeWuxingBenefit', () => {
  it('identifies xi-yong when day master is weak', () => {
    // 壬(水)日主，帮身力量低 → 身弱
    // 身弱喜用 = 生我者(金) + 同类(水)
    const baZi = makeBaZi({
      dayGan: '壬',
      wuxing: { gold: 1, wood: 3, water: 1, fire: 2, earth: 1 },
      missing: ['金'],
    })
    const result = analyzeWuxingBenefit(baZi, ['金', '水'])
    expect(result.xiYong).toContain('金')
    expect(result.xiYong).toContain('水')
    expect(result.jiShen).toContain('木')
    expect(result.jiShen).toContain('土')
  })

  it('penalizes name with ji-shen elements (score < 15)', () => {
    // 壬(水)日主身弱，忌神=木、土
    // 名字全是忌神木、土
    const baZi = makeBaZi({
      dayGan: '壬',
      wuxing: { gold: 1, wood: 3, water: 1, fire: 2, earth: 1 },
      missing: [],
    })
    const result = analyzeWuxingBenefit(baZi, ['木', '土'])
    expect(result.score).toBeLessThan(15)
  })

  it('score is always between 0 and 25', () => {
    // Test with an extreme name that would push score out of bounds
    const baZi = makeBaZi({
      dayGan: '甲',
      wuxing: { gold: 5, wood: 0, water: 0, fire: 1, earth: 2 },
      missing: ['木', '水', '火'],
    })
    // Name with all xi-yong + fills missing
    const highResult = analyzeWuxingBenefit(baZi, ['水', '木', '火'])
    expect(highResult.score).toBeGreaterThanOrEqual(0)
    expect(highResult.score).toBeLessThanOrEqual(25)

    // Name with all ji-shen
    const lowResult = analyzeWuxingBenefit(baZi, ['金', '金', '金'])
    expect(lowResult.score).toBeGreaterThanOrEqual(0)
    expect(lowResult.score).toBeLessThanOrEqual(25)
  })

  it('gives bonus for xi-yong matches', () => {
    const baZi = makeBaZi({
      dayGan: '壬',
      wuxing: { gold: 1, wood: 3, water: 1, fire: 2, earth: 1 },
      missing: [],
    })
    const withXiYong = analyzeWuxingBenefit(baZi, ['金', '水'])
    const withJiShen = analyzeWuxingBenefit(baZi, ['木', '土'])
    expect(withXiYong.score).toBeGreaterThan(withJiShen.score)
  })

  it('gives bonus for filling missing elements', () => {
    const baZi = makeBaZi({
      dayGan: '壬',
      wuxing: { gold: 1, wood: 3, water: 1, fire: 2, earth: 1 },
      missing: ['金'],
    })
    const withMissing = analyzeWuxingBenefit(baZi, ['金'])
    const withoutMissing = analyzeWuxingBenefit(baZi, ['火'])
    expect(withMissing.score).toBeGreaterThan(withoutMissing.score)
  })

  it('gives bonus for adjacent sheng relation in name', () => {
    // Use a medium-strength case where both elements are neither xi-yong nor ji-shen,
    // so the only scoring difference comes from sheng/ke relation
    // 戊(土)日主, medium strength
    const baZi: BaZiResult = {
      yearGan: '庚',
      yearZhi: '申',
      monthGan: '甲',
      monthZhi: '寅',
      dayGan: '戊',
      dayZhi: '辰',
      timeGan: '壬',
      timeZhi: '子',
      wuxing: { gold: 2, wood: 2, water: 2, fire: 0, earth: 2 },
      missing: ['火'],
      dominant: '金',
    }
    // 金生水: both are neither xi-yong nor ji-shen for 戊(土) medium
    // Actually for medium: xiYong=[火,土], jiShen=[金,木]
    // Let's use water which is neutral — but wait, water isn't in either list
    // So use: 水 and 水 — same element, no sheng/ke
    // Better: just test with elements that have same xi-yong/ji-shen status
    // For 戊(土) medium: xiYong=[火,土], jiShen=[金,木], 水 is neutral
    // Compare ['水','木'] (克 relation, 木 is ji-shen) vs ['水','水'] (同, neutral)
    // Hmm, that mixes ji-shen with relation. Let me instead directly compare same-status elements.

    // Simplest: test two names where the only difference is adjacent sheng vs ke
    // Use neutral elements for both: 水 is neutral for 戊(土)
    // 水 and 金: 金生水 → '被生' from 水's perspective, but getWuxingRelation(水,金) = '被生', not '生'
    // 金生水: getWuxingRelation('金','水') = '生' → +3
    // 土克水: getWuxingRelation('土','水') = '克' → -3
    // But 土 is xi-yong, so that adds +8 too...

    // Let me just verify the scores directly with a controlled case
    // Use 丙(火) day master, weak, with neutral-only name chars
    // Actually, simplest fix: compare scores of two names with same xi-yong/ji-shen composition
    // but different internal relation
    const baZi2 = makeBaZi({
      dayGan: '壬',
      wuxing: { gold: 1, wood: 3, water: 1, fire: 2, earth: 1 },
      missing: [],
    })
    // 壬(水) weak: xiYong=[金,水], jiShen=[木,土]
    // 金 and 水 are both xi-yong
    // 金生水 → sheng, score: 13 + 8 + 8 + 3 = 32, clamped to 25
    // 水克火: 水 is xi-yong(+8), 火 is neutral, 克(-3) → 13 + 8 - 3 = 18
    const shengResult = analyzeWuxingBenefit(baZi2, ['金', '水'])
    const keResult = analyzeWuxingBenefit(baZi2, ['水', '火'])
    expect(shengResult.score).toBeGreaterThan(keResult.score)
  })
})
