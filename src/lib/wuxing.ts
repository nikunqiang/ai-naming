// src/lib/wuxing.ts
import { Solar, Lunar } from 'lunar-javascript'
import type { WuxingBenefitResult } from '@/types'

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

// 五行相生链：木生火生土生金生水生木
const SHENG_CHAIN: string[] = ['木', '火', '土', '金', '水']

// 五行相克链：木克土克水克火克金克木
const KE_CHAIN: string[] = ['木', '土', '水', '火', '金']

// 天干→五行映射
const GAN_WUXING: Record<string, string> = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
}

/**
 * 获取两个五行之间的关系
 * 返回 '生' | '克' | '被生' | '被克' | '同' | '无'
 */
export function getWuxingRelation(from: string, to: string): '生' | '克' | '被生' | '被克' | '同' | '无' {
  if (from === to) return '同'

  const fromIdx = SHENG_CHAIN.indexOf(from)
  const toIdx = SHENG_CHAIN.indexOf(to)

  if (fromIdx === -1 || toIdx === -1) return '无'

  // from 生 to: from 的下一个（顺时针）就是 to
  if ((fromIdx + 1) % 5 === toIdx) return '生'
  // from 被 to 生: to 的下一个就是 from
  if ((toIdx + 1) % 5 === fromIdx) return '被生'

  const fromKeIdx = KE_CHAIN.indexOf(from)
  const toKeIdx = KE_CHAIN.indexOf(to)

  if (fromKeIdx === -1 || toKeIdx === -1) return '无'

  // from 克 to: from 的下一个在克链就是 to
  if ((fromKeIdx + 1) % 5 === toKeIdx) return '克'
  // from 被 to 克: to 的下一个在克链就是 from
  if ((toKeIdx + 1) % 5 === fromKeIdx) return '被克'

  return '无'
}

/**
 * 判断日主强弱
 * 根据八字中同类五行和异类五行的对比来判断
 */
function getDayMasterStrength(baZi: BaZiResult): 'strong' | 'weak' | 'medium' {
  const dayGanWuxing = GAN_WUXING[baZi.dayGan]
  if (!dayGanWuxing) return 'medium'

  const wuxing = baZi.wuxing
  const wuxingMap: Record<string, number> = {
    '金': wuxing.gold,
    '木': wuxing.wood,
    '水': wuxing.water,
    '火': wuxing.fire,
    '土': wuxing.earth,
  }

  // 同类：与日主相同五行的数量
  const sameCount = wuxingMap[dayGanWuxing] || 0
  // 生我者的数量
  const shengMeIdx = SHENG_CHAIN.indexOf(dayGanWuxing)
  const shengMeWuxing = SHENG_CHAIN[(shengMeIdx - 1 + 5) % 5]
  const shengMeCount = wuxingMap[shengMeWuxing] || 0

  // 帮身力量 = 同类 + 生我者
  const helpPower = sameCount + shengMeCount

  // 总数（八字共8个字）
  const total = 8

  // 帮身力量超过一半为强，低于一半为弱
  if (helpPower > total / 2) return 'strong'
  if (helpPower < total / 2) return 'weak'
  return 'medium'
}

/**
 * 分析名字五行对八字的补益
 */
export function analyzeWuxingBenefit(baZi: BaZiResult, nameWuxing: string[]): WuxingBenefitResult {
  const dayGanWuxing = GAN_WUXING[baZi.dayGan] || '木'
  const strength = getDayMasterStrength(baZi)

  let xiYong: string[] = []
  let jiShen: string[] = []

  // 生我者、我生者、克我者、我克者、同类
  const shengMeIdx = SHENG_CHAIN.indexOf(dayGanWuxing)
  const shengMe = SHENG_CHAIN[(shengMeIdx - 1 + 5) % 5]   // 生我者
  const woSheng = SHENG_CHAIN[(shengMeIdx + 1) % 5]         // 我生者
  const keMeIdx = KE_CHAIN.indexOf(dayGanWuxing)
  const keWo = KE_CHAIN[(keMeIdx - 1 + 5) % 5]             // 克我者
  const woKe = KE_CHAIN[(keMeIdx + 1) % 5]                  // 我克者

  if (strength === 'strong') {
    // 身强：喜用 = 克我者、我生者、我克者（泄耗克）
    xiYong = [keWo, woSheng, woKe]
    // 忌神 = 生我者、同类
    jiShen = [shengMe, dayGanWuxing]
  } else if (strength === 'weak') {
    // 身弱：喜用 = 生我者、同类
    xiYong = [shengMe, dayGanWuxing]
    // 忌神 = 我生者、克我者
    jiShen = [woSheng, keWo]
  } else {
    // 中等：喜用 = 生我者、同类
    xiYong = [shengMe, dayGanWuxing]
    jiShen = [woSheng, keWo]
  }

  // 计算得分
  let score = 13 // 基础分

  // 名字五行与喜用匹配
  for (const wx of nameWuxing) {
    if (xiYong.includes(wx)) {
      score += 8
    }
    if (jiShen.includes(wx)) {
      score -= 8
    }
  }

  // 补充缺失五行加分
  for (const wx of nameWuxing) {
    if (baZi.missing.includes(wx)) {
      score += 5
    }
  }

  // 相邻名字字符之间相生/相克
  for (let i = 0; i < nameWuxing.length - 1; i++) {
    const relation = getWuxingRelation(nameWuxing[i], nameWuxing[i + 1])
    if (relation === '生') {
      score += 3
    } else if (relation === '克') {
      score -= 3
    }
  }

  // 限制分数范围 0-25
  score = Math.max(0, Math.min(25, score))

  // 生成补益说明
  const xiYongStr = xiYong.join('、')
  const jiShenStr = jiShen.join('、')
  const nameWuxingStr = nameWuxing.join('、')
  const missingStr = baZi.missing.length > 0 ? `八字缺${baZi.missing.join('、')}` : '五行俱全'

  const nameBenefit = `日主${dayGanWuxing}${strength === 'strong' ? '偏强' : strength === 'weak' ? '偏弱' : '中和'}，喜用${xiYongStr}，忌${jiShenStr}。名字五行${nameWuxingStr}，${missingStr}。`

  return { xiYong, jiShen, nameBenefit, score }
}
