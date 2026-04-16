// src/lib/glyph.ts
import charStructureData from '@/../data/char_structure.json'
import type { GlyphResult } from '@/types'
import { getNameChars } from './character'

// Build char → structure type map from the JSON data
const charToStructureType = new Map<string, string>()
for (const [structureType, chars] of Object.entries(charStructureData)) {
  for (const char of chars) {
    charToStructureType.set(char, structureType)
  }
}

/**
 * Calculate standard deviation of an array of numbers
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const squaredDiffs = values.map(v => (v - mean) ** 2)
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length)
}

/**
 * Check if a character falls within the CJK Unified Ideographs range (GB2312 subset)
 */
function isInCJKRange(char: string): boolean {
  const code = char.codePointAt(0)
  if (code === undefined) return false
  return code >= 0x4e00 && code <= 0x9fff
}

/**
 * Analyze glyph structure of a Chinese name
 */
export function analyzeGlyph(name: string, strokes: number[]): GlyphResult {
  let totalDeduction = 0
  const chars = [...name]

  // a. Stroke balance
  let strokeBalance = '笔画均衡'
  const stdDev = standardDeviation(strokes)
  if (stdDev > 5) {
    totalDeduction += 3
    strokeBalance = '笔画差异大'
  } else if (stdDev > 2) {
    totalDeduction += 1
    strokeBalance = '笔画略有差异'
  }

  // b. Writing ease
  let writingEase = '书写便利'
  for (const stroke of strokes) {
    if (stroke > 20) {
      totalDeduction += 2
      writingEase = '难写'
      break
    }
    if (stroke > 15) {
      totalDeduction += 1
      writingEase = '较难写'
      break
    }
  }
  const totalStrokes = strokes.reduce((sum, s) => sum + s, 0)
  if (totalStrokes > 30 && writingEase === '书写便利') {
    totalDeduction += 1
    writingEase = '整体偏繁'
  }

  // c. Visual structure
  let visualStructure = '结构多样'
  for (let i = 0; i < chars.length - 1; i++) {
    const currentType = charToStructureType.get(chars[i])
    const nextType = charToStructureType.get(chars[i + 1])
    if (currentType && nextType && currentType === nextType) {
      totalDeduction += 1
      visualStructure = '结构单一'
      break
    }
  }

  // d. Rarity
  let rarity = '常见字'
  const nameChars = getNameChars()
  for (const char of chars) {
    if (nameChars.includes(char)) {
      continue
    }
    if (isInCJKRange(char)) {
      totalDeduction += 1
      rarity = '较不常见'
    } else {
      totalDeduction += 3
      rarity = '生僻字'
    }
    break
  }

  // e. Score calculation
  const score = Math.max(0, Math.min(10, 10 - totalDeduction))

  return {
    strokeBalance,
    writingEase,
    visualStructure,
    rarity,
    score,
  }
}
