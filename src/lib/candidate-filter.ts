// src/lib/candidate-filter.ts
import { getNameChars, getCharacterInfo } from './character'
import { getDislikedChars } from './db'
import type { CandidateCharPool } from '@/types/naming-events'

/**
 * 构建候选字池
 */
export function buildCandidateCharPool(
  xiYong: string[],
  gender: '男' | '女' | '未定',
  avoidChars: string[] = [],
  maxPrimary: number = 80,
  maxSecondary: number = 40,
): CandidateCharPool {
  const disliked = getDislikedChars()
  const excludeSet = new Set([...avoidChars, ...disliked])

  const genderKey = gender === '男' ? 'boy' : gender === '女' ? 'girl' : undefined
  const allNameChars = getNameChars(genderKey)

  const primaryChars: string[] = []
  const secondaryChars: string[] = []

  for (const char of allNameChars) {
    if (excludeSet.has(char)) continue
    const info = getCharacterInfo(char)
    if (!info) continue

    if (xiYong.length > 0 && xiYong.includes(info.wuxing)) {
      if (primaryChars.length < maxPrimary) primaryChars.push(char)
    } else {
      if (secondaryChars.length < maxSecondary) secondaryChars.push(char)
    }
  }

  return {
    primary: primaryChars,
    secondary: secondaryChars,
    xiYong,
    jiShen: [],
  }
}

/**
 * 无八字时构建通用候选字池（不按五行筛选）
 */
export function buildGenericCharPool(
  gender: '男' | '女' | '未定',
  avoidChars: string[] = [],
  maxChars: number = 100,
): CandidateCharPool {
  const disliked = getDislikedChars()
  const excludeSet = new Set([...avoidChars, ...disliked])

  const genderKey = gender === '男' ? 'boy' : gender === '女' ? 'girl' : undefined
  const allNameChars = getNameChars(genderKey)

  const chars: string[] = []
  for (const char of allNameChars) {
    if (excludeSet.has(char)) continue
    if (chars.length >= maxChars) break
    chars.push(char)
  }

  return {
    primary: [],
    secondary: chars,
    xiYong: [],
    jiShen: [],
  }
}
