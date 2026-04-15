// src/lib/character.ts
import charInfoData from '@/data/char_info.json'
import fiveElementData from '@/data/five_element.json'
import strokeCountData from '@/data/stroke_count.json'
import nameDictData from '@/data/name_dict.json'
import type { CharacterInfo } from '@/types'

// 五行编码映射
const WUXING_MAP: Record<string, string> = {
  'a': '金',
  'b': '木',
  'c': '水',
  'd': '火',
  'e': '土',
  'f': '-'
}

// 字库数据类型
const charInfo: Record<string, string> = charInfoData as Record<string, string>
const fiveElement: Record<string, string> = fiveElementData as Record<string, string>
const strokeCount: Record<string, string> = strokeCountData as Record<string, string>
const nameDict: { boy: string; girl: string } = nameDictData as { boy: string; girl: string }

/**
 * 获取汉字的五行属性
 */
export function getWuxing(char: string): string {
  const info = charInfo[char]
  if (!info || info.length < 2) return '-'
  const wuxingCode = info[1] // 第二个字符为五行主属性
  return WUXING_MAP[wuxingCode] || '-'
}

/**
 * 获取汉字的拼音
 */
export function getPinyin(char: string): string {
  const info = charInfo[char]
  if (!info || info.length < 3) return ''
  // 提取拼音部分（从第三个字符开始，去掉声调符号前的内容）
  const pinyinPart = info.slice(2)
  return pinyinPart
}

/**
 * 获取汉字的笔画数
 */
export function getStrokeCount(char: string): number {
  for (const [count, chars] of Object.entries(strokeCount)) {
    if (chars.includes(char)) {
      return parseInt(count, 10)
    }
  }
  return 0
}

/**
 * 获取汉字完整信息
 */
export function getCharacterInfo(char: string): CharacterInfo | null {
  if (!charInfo[char]) return null

  return {
    char,
    pinyin: getPinyin(char),
    wuxing: getWuxing(char),
    strokes: getStrokeCount(char),
  }
}

/**
 * 按笔画数筛选汉字
 */
export function getCharsByStroke(min: number, max: number): string[] {
  const result: string[] = []
  for (let i = min; i <= max; i++) {
    const chars = strokeCount[i.toString()]
    if (chars) {
      result.push(...chars.split(''))
    }
  }
  return result
}

/**
 * 按五行筛选汉字
 */
export function getCharsByWuxing(wuxing: string): string[] {
  const result: string[] = []
  for (const char of Object.keys(charInfo)) {
    if (getWuxing(char) === wuxing) {
      result.push(char)
    }
  }
  return result
}

/**
 * 获取取名常用字
 */
export function getNameChars(gender?: 'boy' | 'girl'): string[] {
  if (gender === 'boy') {
    return nameDict.boy.split('')
  }
  if (gender === 'girl') {
    return nameDict.girl.split('')
  }
  return [...nameDict.boy.split(''), ...nameDict.girl.split('')]
}

/**
 * 检查是否为常用字
 */
export function isRegularChar(char: string): boolean {
  const regularChars = getNameChars()
  return regularChars.includes(char)
}
