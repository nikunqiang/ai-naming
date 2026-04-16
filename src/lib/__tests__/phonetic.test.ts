// src/lib/__tests__/phonetic.test.ts
import { describe, it, expect, vi } from 'vitest'
import { analyzePhonetic, checkHarmony, extractTone, extractFinal } from '../phonetic'

// Mock character module
vi.mock('../character', () => ({
  getPinyin: vi.fn((char: string) => {
    const map: Record<string, string> = {
      '王': 'wáng',
      '子': 'zǐ',
      '轩': 'xuān',
      '明': 'míng',
      '远': 'yuǎn',
      '天': 'tiān',
      '宇': 'yǔ',
      '浩': 'hào',
      '然': 'rán',
      '思': 'sī',
      '远': 'yuǎn',
      '杜': 'dù',
      '腾': 'téng',
      '范': 'fàn',
      '统': 'tǒng',
      '朱': 'zhū',
      '逸': 'yì',
      '群': 'qún',
      '杨': 'yáng',
      '伟': 'wěi',
      '文': 'wén',
      '博': 'bó',
      '杰': 'jié',
      '建': 'jiàn',
      '国': 'guó',
      '华': 'huá',
      '平': 'píng',
      '安': 'ān',
      '志': 'zhì',
      '强': 'qiáng',
    }
    return map[char] || ''
  }),
}))

describe('analyzePhonetic', () => {
  it('returns score > 15 for ideal tone pattern', () => {
    // 王子轩: wáng(2) zǐ(3) xuān(1) - 平仄平，每相邻都不同，末字非去声
    const result = analyzePhonetic('王子轩')
    expect(result.score).toBeGreaterThan(15)
    expect(result.toneAnalysis).toContain('平仄相间')
    expect(result.pinyins).toEqual(['wáng', 'zǐ', 'xuān'])
    expect(result.tones).toEqual([2, 3, 1])
  })

  it('penalizes all-same tones (score < 15)', () => {
    // 明平华: míng(2) píng(2) huá(2) - 全为阳平，且 ming/ping 同韵母 ing
    const result = analyzePhonetic('明平华')
    expect(result.score).toBeLessThan(15)
    expect(result.toneAnalysis).toContain('单一')
  })

  it('rewards ending with 去声 (contains 收音)', () => {
    // 王志强: wáng(2) zhì(4) qiáng(2) - 末字不是去声
    // 王子建: wáng(2) zǐ(3) jiàn(4) - 末字是去声
    const result = analyzePhonetic('王子建')
    expect(result.toneAnalysis).toContain('收音')
  })

  it('returns score between 0 and 20', () => {
    const result = analyzePhonetic('王子轩')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(20)
  })

  it('populates all fields of PhoneticResult', () => {
    const result = analyzePhonetic('明远')
    expect(result.pinyins).toBeDefined()
    expect(result.tones).toBeDefined()
    expect(result.toneNames).toBeDefined()
    expect(result.toneAnalysis).toBeDefined()
    expect(result.rhymeAnalysis).toBeDefined()
    expect(result.opennessAnalysis).toBeDefined()
    expect(result.analysis).toBeDefined()
    expect(result.score).toBeDefined()
    expect(typeof result.score).toBe('number')
  })
})

describe('checkHarmony', () => {
  it('detects exact matches (杜子腾→肚子疼)', () => {
    const warnings = checkHarmony('杜子腾')
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('肚子疼')])
    )
  })

  it('detects near matches (朱 as first char)', () => {
    const warnings = checkHarmony('朱')
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('猪')])
    )
  })

  it('returns empty for safe names', () => {
    const warnings = checkHarmony('王子轩')
    expect(warnings).toEqual([])
  })
})

describe('extractTone', () => {
  it('extracts tone 1 from first tone', () => {
    expect(extractTone('tiān')).toBe(1)
  })

  it('extracts tone 2 from second tone', () => {
    expect(extractTone('wáng')).toBe(2)
  })

  it('extracts tone 3 from third tone', () => {
    expect(extractTone('zǐ')).toBe(3)
  })

  it('extracts tone 4 from fourth tone', () => {
    expect(extractTone('hào')).toBe(4)
  })

  it('returns 0 for neutral tone', () => {
    expect(extractTone('de')).toBe(0)
  })
})

describe('extractFinal', () => {
  it('extracts final from pinyin with initial', () => {
    expect(extractFinal('wáng')).toBe('ang')
  })

  it('extracts final from pinyin with two-letter initial', () => {
    expect(extractFinal('zhū')).toBe('u')
  })

  it('returns whole pinyin as final when no initial', () => {
    expect(extractFinal('ān')).toBe('an')
  })
})
