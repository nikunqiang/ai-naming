import { describe, it, expect } from 'vitest'
import { analyzeSanCaiWuGeEnhanced, getWugeFortune, getSanCaiLevel } from '../sancai-wuge'

describe('analyzeSanCaiWuGeEnhanced', () => {
  it('returns WuGeDetailResult with score for valid name', () => {
    const result = analyzeSanCaiWuGeEnhanced('王明')
    expect(result).not.toBeNull()
    expect(result!.score).toBeTypeOf('number')
    expect(result!.tianGe).toBeDefined()
    expect(result!.renGe).toBeDefined()
    expect(result!.diGe).toBeDefined()
    expect(result!.waiGe).toBeDefined()
    expect(result!.zongGe).toBeDefined()
    expect(result!.sancaiFortune).toBeTypeOf('string')
    expect(result!.sancaiLevel).toBeDefined()
  })

  it('score is between 0 and 20', () => {
    const result = analyzeSanCaiWuGeEnhanced('李华')
    expect(result).not.toBeNull()
    expect(result!.score).toBeGreaterThanOrEqual(0)
    expect(result!.score).toBeLessThanOrEqual(20)
  })

  it('returns null for empty string', () => {
    expect(analyzeSanCaiWuGeEnhanced('')).toBeNull()
  })

  it('sancaiLevel is one of the valid values', () => {
    const validLevels = ['大吉', '吉', '半吉', '凶', '大凶']
    const result = analyzeSanCaiWuGeEnhanced('张伟')
    expect(result).not.toBeNull()
    expect(validLevels).toContain(result!.sancaiLevel)
  })
})

describe('getWugeFortune', () => {
  it('returns fortune for a number within 1-81', () => {
    const result = getWugeFortune(1)
    expect(result.num).toBe(1)
    expect(result.wuxing).toBeDefined()
    expect(result.fortune).toBeTypeOf('string')
    expect(result.level).toBeDefined()
  })

  it('maps numbers > 81 back to 1-81 range', () => {
    const result = getWugeFortune(82)
    expect(result.num).toBe(1)
  })
})

describe('getSanCaiLevel', () => {
  it('returns 大吉 for fortune with 佳', () => {
    expect(getSanCaiLevel('成功运佳，可顺利发展')).toBe('大吉')
  })

  it('returns 大吉 for fortune with 顺利', () => {
    expect(getSanCaiLevel('成功运佳，发展顺利')).toBe('大吉')
  })

  it('returns 大吉 for fortune with 稳固', () => {
    expect(getSanCaiLevel('成功运佳，基础稳固')).toBe('大吉')
  })

  it('returns 吉 for fortune with 但需', () => {
    expect(getSanCaiLevel('成功运佳，但需防过刚')).toBe('吉')
  })

  it('returns 凶 for fortune with 被压抑', () => {
    expect(getSanCaiLevel('成功运被压抑，多生不平')).toBe('凶')
  })

  it('returns 凶 for fortune with 消极', () => {
    expect(getSanCaiLevel('成功运被压抑，消极不振')).toBe('凶')
  })

  it('returns 大凶 for fortune with 灾祸', () => {
    expect(getSanCaiLevel('成功运不佳，多生灾祸')).toBe('大凶')
  })

  it('returns 大凶 for fortune with 不稳', () => {
    expect(getSanCaiLevel('成功运不佳，基础不稳')).toBe('大凶')
  })

  it('returns 半吉 for other fortunes', () => {
    expect(getSanCaiLevel('运势一般')).toBe('半吉')
  })
})
