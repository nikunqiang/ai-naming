// src/lib/phonetic.ts
import { getPinyin } from './character'

// 声调映射
const TONE_MAP: Record<string, number> = {
  'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4,
  'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
  'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4,
  'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
  'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4,
  'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4,
}

// 声调名称
const TONE_NAMES: Record<number, string> = {
  1: '阴平',
  2: '阳平',
  3: '上声',
  4: '去声',
  0: '轻声',
}

/**
 * 提取拼音中的声调
 */
export function extractTone(pinyin: string): number {
  for (const char of pinyin) {
    if (TONE_MAP[char]) {
      return TONE_MAP[char]
    }
  }
  // 没有声调符号，检查末尾数字
  const lastChar = pinyin.slice(-1)
  if (['1', '2', '3', '4'].includes(lastChar)) {
    return parseInt(lastChar, 10)
  }
  return 0
}

/**
 * 分析名字的音律
 */
export function analyzePhonetic(name: string): {
  pinyins: string[]
  tones: number[]
  toneNames: string[]
  analysis: string
} {
  const chars = name.split('')
  const pinyins: string[] = []
  const tones: number[] = []
  const toneNames: string[] = []

  for (const char of chars) {
    const pinyin = getPinyin(char)
    pinyins.push(pinyin)
    const tone = extractTone(pinyin)
    tones.push(tone)
    toneNames.push(TONE_NAMES[tone] || '轻声')
  }

  // 分析声调搭配
  const analysis = analyzeTonePattern(tones)

  return {
    pinyins,
    tones,
    toneNames,
    analysis,
  }
}

/**
 * 分析声调搭配
 */
function analyzeTonePattern(tones: number[]): string {
  if (tones.length === 0) return ''

  // 检查是否全同声调
  const allSame = tones.every(t => t === tones[0])
  if (allSame && tones[0] !== 0) {
    return '声调单一，略显平淡'
  }

  // 检查声调变化
  const changes = tones.filter((t, i) => i > 0 && t !== tones[i - 1]).length

  if (changes === 0) {
    return '声调平稳'
  } else if (changes === tones.length - 1) {
    return '声调起伏有致，抑扬顿挫'
  } else if (changes >= 1) {
    return '声调搭配和谐'
  }

  return '声调搭配一般'
}

/**
 * 检查是否有不良谐音
 */
export function checkHarmony(name: string): string[] {
  const warnings: string[] = []

  // 常见不良谐音检查
  const badHarmonies: Record<string, string> = {
    '杜子腾': '肚子疼',
    '范统': '饭桶',
    '朱逸群': '猪一群',
    '杨伟': '阳痿',
    '范剑': '犯贱',
    '沈京': '神经',
    '苟史': '狗屎',
    '史珍香': '屎真香',
  }

  for (const [bad, warning] of Object.entries(badHarmonies)) {
    if (name.includes(bad) || name === bad) {
      warnings.push(`谐音"${warning}"`)
    }
  }

  return warnings
}
