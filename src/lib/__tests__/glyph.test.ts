// src/lib/__tests__/glyph.test.ts
import { describe, it, expect } from 'vitest'
import { analyzeGlyph } from '../glyph'

describe('analyzeGlyph', () => {
  it('balanced name (明远 [8,7]) should score > 7', () => {
    const result = analyzeGlyph('明远', [8, 7])
    expect(result.score).toBeGreaterThan(7)
    expect(result.strokeBalance).toBe('笔画均衡')
  })

  it('unbalanced strokes (一鑫 [1,24]) should score < 8 and contain "差异"', () => {
    const result = analyzeGlyph('一鑫', [1, 24])
    expect(result.score).toBeLessThan(8)
    expect(result.strokeBalance).toContain('差异')
  })

  it('hard to write (鑫 [24]) should contain "难写"', () => {
    const result = analyzeGlyph('鑫', [24])
    expect(result.writingEase).toContain('难写')
  })

  it('rare char (彧 [10]) should contain "生僻" or "较不常见"', () => {
    const result = analyzeGlyph('彧', [10])
    // 彧 is in CJK range but likely not in nameChars
    expect(result.rarity).toMatch(/生僻|较不常见/)
  })

  it('score should always be between 0 and 10', () => {
    const cases = [
      { name: '明远', strokes: [8, 7] },
      { name: '一鑫', strokes: [1, 24] },
      { name: '鑫', strokes: [24] },
      { name: '彧', strokes: [10] },
    ]
    for (const { name, strokes } of cases) {
      const result = analyzeGlyph(name, strokes)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(10)
    }
  })
})
