// src/lib/sancai-wuge.ts
import { getStrokeCount } from './character'
import type { SanCaiResult, WuGeResult } from '@/types'

// 三才五行对应
const SANCAI_WUXING = '水木木火火土土金金水'

// 三才吉凶配置
const SANCAI_FORTUNE: Record<string, string> = {
  '木木木': '成功运佳，可顺利发展',
  '木木火': '成功运佳，向上发展',
  '木木土': '成功运被压抑，基础不稳',
  '木火木': '成功运佳，发展顺利',
  '木火火': '成功运佳，但需防过刚',
  '木火土': '成功运佳，基础稳固',
  '木土木': '成功运被压抑，多生不平',
  '木土火': '成功运不佳，颇为顽固',
  '木土土': '成功运被压抑，消极不振',
  '木金木': '成功运被压抑，易生不平',
  '木金火': '成功运不佳，基础不稳',
  '木金土': '成功运不佳，颇为消极',
  '木金金': '成功运不佳，易生灾祸',
  '木水木': '成功运佳，基础稳固',
  '木水火': '成功运不佳，多生灾祸',
  '木水土': '成功运不佳，基础不稳',
  '木水金': '成功运不佳，多生不平',
  '木水水': '成功运佳，但需防意外',
  '火木木': '成功运佳，发展顺利',
  '火木火': '成功运佳，向上发展',
  '火木土': '成功运佳，基础稳固',
  '火火木': '成功运佳，但需防过刚',
  '火火火': '成功运过旺，易生灾祸',
  '火火土': '成功运佳，基础稳固',
  '火土木': '成功运被压抑，多生不平',
  '火土火': '成功运佳，但需努力',
  '火土土': '成功运被压抑，消极不振',
  '火金木': '成功运不佳，多生灾祸',
  '火金火': '成功运不佳，易生意外',
  '火金土': '成功运不佳，颇为消极',
  '火金金': '成功运不佳，多生灾祸',
  '火水木': '成功运不佳，多生灾祸',
  '火水火': '成功运不佳，易生意外',
  '火水土': '成功运不佳，基础不稳',
  '火水金': '成功运不佳，多生灾祸',
  '火水水': '成功运不佳，易生意外',
  '土木木': '成功运被压抑，基础不稳',
  '土木火': '成功运被压抑，但可成功',
  '土木土': '成功运被压抑，消极不振',
  '土火木': '成功运佳，发展顺利',
  '土火火': '成功运佳，但需努力',
  '土火土': '成功运佳，基础稳固',
  '土土木': '成功运被压抑，多生不平',
  '土土火': '成功运不佳，颇为消极',
  '土土土': '成功运被压抑，消极不振',
  '土土金': '成功运不佳，基础不稳',
  '土金木': '成功运不佳，多生不平',
  '土金火': '成功运不佳，颇为消极',
  '土金土': '成功运不佳，基础不稳',
  '土金金': '成功运不佳，多生灾祸',
  '土水木': '成功运不佳，基础不稳',
  '土水火': '成功运不佳，多生灾祸',
  '土水土': '成功运不佳，基础不稳',
  '土水金': '成功运不佳，多生灾祸',
  '土水水': '成功运不佳，易生意外',
  '金木木': '成功运不佳，多生灾祸',
  '金木火': '成功运不佳，易生意外',
  '金木土': '成功运不佳，多生不平',
  '金火木': '成功运不佳，多生灾祸',
  '金火火': '成功运不佳，易生意外',
  '金火土': '成功运不佳，颇为消极',
  '金土木': '成功运不佳，多生不平',
  '金土火': '成功运不佳，颇为消极',
  '金土土': '成功运不佳，基础不稳',
  '金土金': '成功运不佳，基础不稳',
  '金金木': '成功运不佳，多生灾祸',
  '金金火': '成功运不佳，易生意外',
  '金金土': '成功运不佳，基础不稳',
  '金金金': '成功运过刚，易生灾祸',
  '金水木': '成功运不佳，多生不平',
  '金水火': '成功运不佳，多生灾祸',
  '金水土': '成功运不佳，基础不稳',
  '金水金': '成功运不佳，多生不平',
  '金水水': '成功运不佳，易生意外',
  '水木木': '成功运佳，发展顺利',
  '水木火': '成功运佳，向上发展',
  '水木土': '成功运佳，基础稳固',
  '水火木': '成功运不佳，多生灾祸',
  '水火火': '成功运不佳，易生意外',
  '水火土': '成功运不佳，颇为消极',
  '水土木': '成功运被压抑，多生不平',
  '水土火': '成功运不佳，颇为消极',
  '水土土': '成功运不佳，基础不稳',
  '水金木': '成功运不佳，多生不平',
  '水金火': '成功运不佳，多生灾祸',
  '水金土': '成功运不佳，基础不稳',
  '水金金': '成功运不佳，多生不平',
  '水水木': '成功运佳，但需防意外',
  '水水火': '成功运不佳，易生意外',
  '水水土': '成功运不佳，基础不稳',
  '水水金': '成功运不佳，多生不平',
  '水水水': '成功运过旺，易生灾祸',
}

/**
 * 计算五格
 * @param surnameStrokes 姓氏各字笔画数
 * @param nameStrokes 名字各字笔画数
 */
export function calculateWuGe(surnameStrokes: number[], nameStrokes: number[]): WuGeResult {
  const l1 = surnameStrokes[0] || 0
  const l2 = surnameStrokes[1] || 0
  const f1 = nameStrokes[0] || 0
  const f2 = nameStrokes[1] || 0

  // 天格：复姓为姓的笔画相加，单姓为姓的笔画加一
  const tianGe = l2 === 0 ? l1 + 1 : l1 + l2

  // 人格：复姓为姓的第二字+名的第一字，单姓为姓+名的第一字
  const renGe = l2 !== 0 ? l2 + f1 : l1 + f1

  // 地格：复名为名相加，单名为名+1
  const diGe = f2 === 0 ? f1 + 1 : f1 + f2

  // 外格
  let waiGe: number
  if (l2 === 0 && f2 === 0) {
    waiGe = 2 // 单姓单名
  } else if (l2 === 0 && f2 !== 0) {
    waiGe = 1 + f2 // 单姓复名
  } else if (l2 !== 0 && f2 === 0) {
    waiGe = l1 + 1 // 复姓单名
  } else {
    waiGe = l1 + f2 // 复姓复名
  }

  // 总格：所有笔画相加
  const zongGe = l1 + l2 + f1 + f2

  return { tianGe, renGe, diGe, waiGe, zongGe }
}

/**
 * 根据数推算五行
 * 1-2木，3-4火，5-6土，7-8金，9-10水
 */
export function numberToWuxing(num: number): string {
  const remainder = num % 10
  return SANCAI_WUXING[remainder]
}

/**
 * 计算三才
 */
export function calculateSanCai(wuge: WuGeResult): SanCaiResult {
  const tianCai = numberToWuxing(wuge.tianGe)
  const renCai = numberToWuxing(wuge.renGe)
  const diCai = numberToWuxing(wuge.diGe)

  const key = `${tianCai}${renCai}${diCai}`
  const fortune = SANCAI_FORTUNE[key] || '运势一般'

  return {
    tianCai,
    renCai,
    diCai,
    fortune,
  }
}

/**
 * 分析姓名的三才五格
 */
export function analyzeSanCaiWuGe(fullName: string): { wuge: WuGeResult; sancai: SanCaiResult } | null {
  if (!fullName || fullName.length < 2) return null

  // 假设单姓
  const surname = fullName[0]
  const name = fullName.slice(1)

  const surnameStrokes = [getStrokeCount(surname)]
  const nameStrokes = name.split('').map(c => getStrokeCount(c))

  const wuge = calculateWuGe(surnameStrokes, nameStrokes)
  const sancai = calculateSanCai(wuge)

  return { wuge, sancai }
}
