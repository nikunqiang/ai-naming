// src/lib/wuxing.ts
import { Solar, Lunar } from 'lunar-javascript'

// 五行统计
export interface WuxingStats {
  gold: number
  wood: number
  water: number
  fire: number
  earth: number
}

// 八字结果
export interface BaZiResult {
  yearGan: string
  yearZhi: string
  monthGan: string
  monthZhi: string
  dayGan: string
  dayZhi: string
  timeGan: string
  timeZhi: string
  wuxing: WuxingStats
  missing: string[]
  dominant: string
}

/**
 * 根据出生时间计算八字
 */
export function calculateBaZi(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0
): BaZiResult | null {
  try {
    const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
    const lunar = solar.getLunar()
    const bazi = lunar.getEightChar()

    const yearGan = bazi.getYearGan()
    const yearZhi = bazi.getYearZhi()
    const monthGan = bazi.getMonthGan()
    const monthZhi = bazi.getMonthZhi()
    const dayGan = bazi.getDayGan()
    const dayZhi = bazi.getDayZhi()
    const timeGan = bazi.getTimeGan()
    const timeZhi = bazi.getTimeZhi()

    // 统计五行
    const wuxing = countWuxing(
      [yearGan, yearZhi, monthGan, monthZhi, dayGan, dayZhi, timeGan, timeZhi]
    )

    // 找出缺失的五行
    const missing = findMissingWuxing(wuxing)

    // 找出主导五行
    const dominant = findDominantWuxing(wuxing)

    return {
      yearGan,
      yearZhi,
      monthGan,
      monthZhi,
      dayGan,
      dayZhi,
      timeGan,
      timeZhi,
      wuxing,
      missing,
      dominant,
    }
  } catch {
    return null
  }
}

/**
 * 统计五行数量
 */
function countWuxing(chars: string[]): WuxingStats {
  const wuxingMap: Record<string, string> = {
    '甲': '木', '乙': '木', '寅': '木', '卯': '木',
    '丙': '火', '丁': '火', '巳': '火', '午': '火',
    '戊': '土', '己': '土', '辰': '土', '丑': '土', '未': '土', '戌': '土',
    '庚': '金', '辛': '金', '申': '金', '酉': '金',
    '壬': '水', '癸': '水', '亥': '水', '子': '水',
  }

  const stats: WuxingStats = { gold: 0, wood: 0, water: 0, fire: 0, earth: 0 }

  for (const char of chars) {
    const wx = wuxingMap[char]
    if (wx === '金') stats.gold++
    else if (wx === '木') stats.wood++
    else if (wx === '水') stats.water++
    else if (wx === '火') stats.fire++
    else if (wx === '土') stats.earth++
  }

  return stats
}

/**
 * 找出缺失的五行
 */
function findMissingWuxing(stats: WuxingStats): string[] {
  const missing: string[] = []
  if (stats.gold === 0) missing.push('金')
  if (stats.wood === 0) missing.push('木')
  if (stats.water === 0) missing.push('水')
  if (stats.fire === 0) missing.push('火')
  if (stats.earth === 0) missing.push('土')
  return missing
}

/**
 * 找出主导五行
 */
function findDominantWuxing(stats: WuxingStats): string {
  const map: Record<string, number> = {
    '金': stats.gold,
    '木': stats.wood,
    '水': stats.water,
    '火': stats.fire,
    '土': stats.earth,
  }

  let max = 0
  let dominant = ''
  for (const [wx, count] of Object.entries(map)) {
    if (count > max) {
      max = count
      dominant = wx
    }
  }
  return dominant
}

/**
 * 解析出生时间字符串
 */
export function parseBirthTime(birthTime: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  try {
    const date = new Date(birthTime)
    if (isNaN(date.getTime())) return null
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    }
  } catch {
    return null
  }
}
