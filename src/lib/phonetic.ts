// src/lib/phonetic.ts
import { getPinyin } from './character'
import type { PhoneticResult } from '@/types'
import harmonyData from '@/../data/harmony_warnings.json'

// 声调映射：带调号元音 → 声调数字
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

// 声母列表（按长度降序排列以优先匹配双字母声母）
const INITIALS = [
  'zh', 'ch', 'sh',
  'b', 'p', 'm', 'f',
  'd', 't', 'n', 'l',
  'g', 'k', 'h',
  'j', 'q', 'x',
  'r', 'z', 'c', 's',
  'y', 'w',
]

// 近韵对
const NEAR_RHYME_PAIRS: [string, string][] = [
  ['an', 'ang'],
  ['en', 'eng'],
  ['in', 'ing'],
  ['on', 'ong'],
]

// 开口音韵母
const OPEN_FINALS = new Set([
  'a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng',
])

// 闭口音韵母
const CLOSED_FINALS = new Set([
  'i', 'u', 'ü', 'in', 'un', 'ing', 'ia', 'ie', 'iu', 'ua', 'uo', 'ui',
])

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
 * 将带调号拼音转换为无声调形式，用于韵母提取
 */
function stripTone(pinyin: string): string {
  const toneMap: Record<string, string> = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
  }
  let result = ''
  for (const char of pinyin) {
    result += toneMap[char] || char
  }
  return result
}

/**
 * 从拼音中提取韵母（去掉声母部分）
 */
export function extractFinal(pinyin: string): string {
  const plain = stripTone(pinyin)
  for (const initial of INITIALS) {
    if (plain.startsWith(initial)) {
      return plain.slice(initial.length)
    }
  }
  // 无声母，整个就是韵母
  return plain
}

/**
 * 判断两个韵母是否为近韵
 */
function areNearRhyme(final1: string, final2: string): boolean {
  for (const [a, b] of NEAR_RHYME_PAIRS) {
    if ((final1 === a && final2 === b) || (final1 === b && final2 === a)) {
      return true
    }
  }
  return false
}

/**
 * 判断韵母是开口音还是闭口音
 * 返回 'open' | 'closed' | 'neutral'
 */
function classifyOpenness(final: string): 'open' | 'closed' | 'neutral' {
  if (OPEN_FINALS.has(final)) return 'open'
  if (CLOSED_FINALS.has(final)) return 'closed'
  return 'neutral'
}

/**
 * 分析声调搭配
 */
function analyzeTonePattern(tones: number[]): { analysis: string; deduction: number } {
  if (tones.length === 0) return { analysis: '', deduction: 0 }

  const validTones = tones.filter(t => t > 0)

  // 检查是否全同声调
  const allSame = validTones.length > 0 && validTones.every(t => t === validTones[0])
  if (allSame) {
    return { analysis: '声调单一，缺乏变化，略显平淡', deduction: 5 }
  }

  // 统计相邻声调变化次数
  const changes = tones.filter((t, i) => i > 0 && t !== tones[i - 1] && t > 0 && tones[i - 1] > 0).length

  // 平仄分析：1、2声为平，3、4声为仄
  const pingZe = tones.map(t => (t === 1 || t === 2) ? '平' : (t === 3 || t === 4) ? '仄' : '?')
  const hasPing = pingZe.includes('平')
  const hasZe = pingZe.includes('仄')

  // 末字声调
  const lastTone = tones[tones.length - 1]

  let analysis = ''
  let deduction = 0

  if (changes === tones.length - 1 && hasPing && hasZe) {
    // 平仄相间，每相邻两字都不同
    analysis = '平仄相间，声调起伏有致，抑扬顿挫'
  } else if (changes >= 1 && hasPing && hasZe) {
    // 有平有仄但非完全相间
    analysis = '声调搭配和谐，有起伏变化'
  } else if (changes >= 1) {
    analysis = '声调有一定变化'
    deduction = 2
  } else {
    analysis = '声调搭配一般'
    deduction = 3
  }

  // 末字去声加分（在返回的 analysis 中体现，扣分为0表示bonus）
  if (lastTone === 4) {
    analysis += '，收音有力'
  }

  return { analysis, deduction }
}

/**
 * 分析韵母搭配
 */
function analyzeRhymePattern(finals: string[]): { analysis: string; deduction: number } {
  if (finals.length < 2) return { analysis: '', deduction: 0 }

  let deduction = 0
  const issues: string[] = []

  for (let i = 0; i < finals.length - 1; i++) {
    for (let j = i + 1; j < finals.length; j++) {
      if (finals[i] === finals[j] && finals[i] !== '') {
        // 同韵
        issues.push('同韵')
        deduction += 3
        break // 每对只计一次
      } else if (areNearRhyme(finals[i], finals[j])) {
        // 近韵
        issues.push('近韵')
        deduction += 1
        break
      }
    }
    if (issues.length > 0) break // 避免重复扣分
  }

  let analysis = ''
  if (issues.includes('同韵')) {
    analysis = '韵母相同，音律略显单调'
  } else if (issues.includes('近韵')) {
    analysis = '韵母相近，音律稍显单调'
  } else {
    analysis = '韵母搭配多样，音律丰富'
  }

  return { analysis, deduction }
}

/**
 * 分析开闭口音搭配
 */
function analyzeOpennessPattern(finals: string[]): { analysis: string; deduction: number } {
  if (finals.length < 2) return { analysis: '', deduction: 0 }

  const classifications = finals.map(f => classifyOpenness(f))
  const validClassifications = classifications.filter(c => c !== 'neutral')

  if (validClassifications.length < 2) return { analysis: '', deduction: 0 }

  const allOpen = validClassifications.every(c => c === 'open')
  const allClosed = validClassifications.every(c => c === 'closed')

  if (allOpen) {
    return { analysis: '全为开口音，发音缺乏变化', deduction: 3 }
  }

  if (allClosed) {
    return { analysis: '全为闭口音，发音略显沉闷', deduction: 3 }
  }

  return { analysis: '开闭口音搭配得当，发音变化自然', deduction: 0 }
}

/**
 * 分析名字的音律
 */
export function analyzePhonetic(name: string): PhoneticResult {
  const chars = name.split('')
  const pinyins: string[] = []
  const tones: number[] = []
  const toneNames: string[] = []
  const finals: string[] = []

  for (const char of chars) {
    const pinyin = getPinyin(char)
    pinyins.push(pinyin)
    const tone = extractTone(pinyin)
    tones.push(tone)
    toneNames.push(TONE_NAMES[tone] || '轻声')
    finals.push(extractFinal(pinyin))
  }

  // 声调分析
  const toneResult = analyzeTonePattern(tones)

  // 韵母分析
  const rhymeResult = analyzeRhymePattern(finals)

  // 开闭口音分析
  const opennessResult = analyzeOpennessPattern(finals)

  // 末字去声bonus
  const lastTone = tones[tones.length - 1]
  const endingBonus = lastTone === 4 ? 2 : 0

  // 综合评价
  const parts: string[] = []
  if (toneResult.analysis) parts.push(toneResult.analysis)
  if (rhymeResult.analysis) parts.push(rhymeResult.analysis)
  if (opennessResult.analysis) parts.push(opennessResult.analysis)
  const analysis = parts.join('；')

  // 计算得分：满分20，扣分制
  let score = 20
  score -= toneResult.deduction
  score -= rhymeResult.deduction
  score -= opennessResult.deduction
  score += endingBonus
  score = Math.max(0, Math.min(20, score))

  return {
    pinyins,
    tones,
    toneNames,
    toneAnalysis: toneResult.analysis,
    rhymeAnalysis: rhymeResult.analysis,
    opennessAnalysis: opennessResult.analysis,
    analysis,
    score,
  }
}

/**
 * 检查是否有不良谐音（从 harmony_warnings.json 加载数据）
 */
export function checkHarmony(name: string): string[] {
  const warnings: string[] = []

  const exactMap = harmonyData.exact as Record<string, string>
  const nearMap = harmonyData.near as Record<string, string>

  // 精确匹配
  for (const [bad, warning] of Object.entries(exactMap)) {
    if (name.includes(bad) || name === bad) {
      warnings.push(`谐音"${warning}"`)
    }
  }

  // 近似匹配：名字中包含谐音字
  for (const [char, warning] of Object.entries(nearMap)) {
    if (name.includes(char)) {
      // 避免与精确匹配重复
      const warningText = `谐音"${warning}"`
      if (!warnings.includes(warningText)) {
        warnings.push(warningText)
      }
    }
  }

  return warnings
}
