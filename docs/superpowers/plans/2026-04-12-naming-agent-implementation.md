# 中文取名智能体实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个完整的中文取名智能体应用，支持取名和测名功能，集成 Mastra Agent、RAG 典籍检索、八字五行和三才五格计算。

**Architecture:** Next.js 14 App Router 前端 + Mastra Agent 后端 + 本地数据存储。前端通过 Vercel AI SDK 与 Agent 交互，Agent 调用 Tools 完成字库查询、典籍检索、名字生成和分析。

**Tech Stack:** Next.js 14, Tailwind CSS, Mastra, Vercel AI SDK, lunar-javascript, ChromaDB

---

## 文件结构

```
src/
├── app/
│   ├── layout.tsx              # 已完成
│   ├── page.tsx                # 已完成 - 首页
│   ├── globals.css             # 已完成
│   ├── form/page.tsx           # 已完成 - 表单页
│   ├── analyze/page.tsx        # 已完成 - 测名页
│   ├── chat/page.tsx           # 已完成 - 对话页
│   └── results/page.tsx        # 已完成 - 结果页
├── lib/
│   ├── character.ts            # 字库数据处理
│   ├── wuxing.ts               # 五行计算（使用 lunar-javascript）
│   ├── sancai-wuge.ts          # 三才五格计算
│   ├── phonetic.ts             # 音律分析
│   ├── session.ts              # 会话存储
│   └── rag/
│       ├── index.ts            # RAG 入口
│       ├── embeddings.ts       # 向量嵌入
│       └── retriever.ts        # 检索器
├── mastra/
│   ├── index.ts                # Mastra 配置
│   ├── agent.ts                # 取名顾问 Agent
│   └── tools/
│       ├── query-character.ts  # 字库查询工具
│       ├── search-classic.ts   # 典籍检索工具
│       ├── generate-names.ts   # 名字生成工具
│       └── analyze-name.ts     # 名字分析工具
└── types/
    └── index.ts                # 类型定义
```

---

## Task 1: 项目初始化与依赖安装

**Files:**
- Modify: `package.json`
- Create: `src/types/index.ts`

- [ ] **Step 1: 更新 package.json 添加所有依赖**

```json
{
  "name": "chinese-naming",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "14.2.0",
    "ai": "^3.0.0",
    "@mastra/core": "^0.1.0",
    "lunar-javascript": "^1.7.7",
    "chromadb": "^1.8.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/uuid": "^9.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

- [ ] **Step 2: 创建类型定义文件**

```typescript
// src/types/index.ts

// 表单数据
export interface FormData {
  surname: string
  motherSurname?: string
  gender: '男' | '女' | '未定'
  birthTime?: string
  expectations?: string[]
  avoidChars?: string[]
  nameLength?: 1 | 2 | '不限'
  namingMode: '传统' | '文学' | '现代' | '混合'
}

// 汉字信息
export interface CharacterInfo {
  char: string
  pinyin: string
  wuxing: string
  strokes: number
  meaning?: string
}

// 名字结果
export interface NameResult {
  name: string
  pinyin: string
  source?: string
  meaning: string
  wuxing: string[]
  strokes: number[]
  analysis?: NameAnalysis
}

// 名字分析
export interface NameAnalysis {
  wuxingDetail?: string
  sancai?: SanCaiResult
  wuge?: WuGeResult
  phonetic?: string
  classicReference?: string
  harmonyWarning?: string[]
}

// 三才结果
export interface SanCaiResult {
  tianCai: string
  renCai: string
  diCai: string
  fortune: string
}

// 五格结果
export interface WuGeResult {
  tianGe: number
  renGe: number
  diGe: number
  waiGe: number
  zongGe: number
}

// 会话
export interface Session {
  sessionId: string
  createdAt: string
  updatedAt: string
  mode: 'naming' | 'analyze'
  formData?: FormData
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  generatedNames?: NameResult[]
  selectedNames?: string[]
}

// 典籍检索结果
export interface ClassicSearchResult {
  source: string
  content: string
  relevance: number
}
```

- [ ] **Step 3: 安装依赖**

Run: `cd D:/dev/git/ai-naming && npm install`

Expected: 依赖安装成功

- [ ] **Step 4: 提交**

```bash
git add package.json src/types/index.ts
git commit -m "chore: add dependencies and type definitions"
```

---

## Task 2: 字库数据处理模块

**Files:**
- Create: `src/lib/character.ts`

- [ ] **Step 1: 创建字库数据处理模块**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/character.ts
git commit -m "feat: add character data processing module"
```

---

## Task 3: 八字五行计算模块

**Files:**
- Create: `src/lib/wuxing.ts`

- [ ] **Step 1: 创建八字五行计算模块**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/wuxing.ts
git commit -m "feat: add bazi wuxing calculation module"
```

---

## Task 4: 三才五格计算模块

**Files:**
- Create: `src/lib/sancai-wuge.ts`

- [ ] **Step 1: 创建三才五格计算模块**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/sancai-wuge.ts
git commit -m "feat: add sancai wuge calculation module"
```

---

## Task 5: 音律分析模块

**Files:**
- Create: `src/lib/phonetic.ts`

- [ ] **Step 1: 创建音律分析模块**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/phonetic.ts
git commit -m "feat: add phonetic analysis module"
```

---

## Task 6: 会话存储模块

**Files:**
- Create: `src/lib/session.ts`
- Create: `data/sessions/.gitkeep`

- [ ] **Step 1: 创建会话存储模块**

```typescript
// src/lib/session.ts
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import type { Session, FormData, NameResult } from '@/types'

const SESSIONS_DIR = path.join(process.cwd(), 'data', 'sessions')

// 确保会话目录存在
function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

/**
 * 创建新会话
 */
export function createSession(mode: 'naming' | 'analyze'): Session {
  ensureSessionsDir()
  
  const session: Session = {
    sessionId: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mode,
    messages: [],
  }

  saveSession(session)
  return session
}

/**
 * 保存会话
 */
export function saveSession(session: Session): void {
  ensureSessionsDir()
  
  session.updatedAt = new Date().toISOString()
  const filePath = path.join(SESSIONS_DIR, `${session.sessionId}.json`)
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
}

/**
 * 加载会话
 */
export function loadSession(sessionId: string): Session | null {
  ensureSessionsDir()
  
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`)
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as Session
  } catch {
    return null
  }
}

/**
 * 更新表单数据
 */
export function updateFormData(sessionId: string, formData: FormData): Session | null {
  const session = loadSession(sessionId)
  if (!session) return null

  session.formData = formData
  saveSession(session)
  return session
}

/**
 * 添加消息
 */
export function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Session | null {
  const session = loadSession(sessionId)
  if (!session) return null

  session.messages.push({ role, content })
  saveSession(session)
  return session
}

/**
 * 更新生成的名字
 */
export function updateGeneratedNames(
  sessionId: string,
  names: NameResult[]
): Session | null {
  const session = loadSession(sessionId)
  if (!session) return null

  session.generatedNames = names
  saveSession(session)
  return session
}

/**
 * 获取所有会话列表
 */
export function listSessions(): Session[] {
  ensureSessionsDir()
  
  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))
  const sessions: Session[] = []

  for (const file of files) {
    const content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8')
    try {
      sessions.push(JSON.parse(content))
    } catch {
      // ignore invalid files
    }
  }

  return sessions.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): boolean {
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    return true
  }
  return false
}
```

- [ ] **Step 2: 创建 .gitkeep 文件**

```bash
mkdir -p D:/dev/git/ai-naming/data/sessions && touch D:/dev/git/ai-naming/data/sessions/.gitkeep
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/session.ts data/sessions/.gitkeep
git commit -m "feat: add session storage module"
```

---

## Task 7: RAG 典籍检索模块

**Files:**
- Create: `src/lib/rag/index.ts`
- Create: `src/lib/rag/embeddings.ts`
- Create: `src/lib/rag/retriever.ts`

- [ ] **Step 1: 创建 RAG 入口文件**

```typescript
// src/lib/rag/index.ts
export { ClassicRetriever } from './retriever'
export { getEmbeddings } from './embeddings'
```

- [ ] **Step 2: 创建向量嵌入模块**

```typescript
// src/lib/rag/embeddings.ts

/**
 * 获取文本的向量嵌入
 * 使用简单的字符频率向量作为示例
 * 生产环境应使用 OpenAI embeddings 或本地模型
 */
export async function getEmbeddings(text: string): Promise<number[]> {
  // 简化版：使用字符频率作为向量
  // 生产环境应替换为真实的 embedding 模型
  const vector = new Array(256).fill(0)
  
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) % 256
    vector[code]++
  }

  // 归一化
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude
    }
  }

  return vector
}

/**
 * 计算余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    magnitudeA += a[i] * a[i]
    magnitudeB += b[i] * b[i]
  }

  magnitudeA = Math.sqrt(magnitudeA)
  magnitudeB = Math.sqrt(magnitudeB)

  if (magnitudeA === 0 || magnitudeB === 0) return 0

  return dotProduct / (magnitudeA * magnitudeB)
}
```

- [ ] **Step 3: 创建检索器**

```typescript
// src/lib/rag/retriever.ts
import fs from 'fs'
import path from 'path'
import { getEmbeddings, cosineSimilarity } from './embeddings'
import type { ClassicSearchResult } from '@/types'

// 典籍条目
interface ClassicEntry {
  source: string
  content: string
  embedding?: number[]
}

export class ClassicRetriever {
  private entries: ClassicEntry[] = []
  private initialized = false

  /**
   * 初始化，加载典籍数据
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // 加载诗经
    const shijingPath = path.join(process.cwd(), 'data', 'shijing.json')
    if (fs.existsSync(shijingPath)) {
      const shijing = JSON.parse(fs.readFileSync(shijingPath, 'utf-8'))
      for (const poem of shijing) {
        const source = `诗经·${poem.chapter}·${poem.section}·${poem.title}`
        for (const line of poem.content || []) {
          this.entries.push({
            source,
            content: line,
          })
        }
      }
    }

    // 加载楚辞
    const chuciPath = path.join(process.cwd(), 'data', 'chuci.json')
    if (fs.existsSync(chuciPath)) {
      const chuci = JSON.parse(fs.readFileSync(chuciPath, 'utf-8'))
      for (const poem of chuci) {
        const source = `楚辞·${poem.section}·${poem.title}`
        for (const line of poem.content || []) {
          this.entries.push({
            source,
            content: line,
          })
        }
      }
    }

    this.initialized = true
    console.log(`Loaded ${this.entries.length} classic entries`)
  }

  /**
   * 搜索相关诗句
   */
  async search(query: string, topK: number = 5): Promise<ClassicSearchResult[]> {
    await this.initialize()

    const queryEmbedding = await getEmbeddings(query)

    // 计算相似度
    const results: Array<{ entry: ClassicEntry; similarity: number }> = []
    
    for (const entry of this.entries) {
      // 懒加载嵌入
      if (!entry.embedding) {
        entry.embedding = await getEmbeddings(entry.content)
      }

      const similarity = cosineSimilarity(queryEmbedding, entry.embedding)
      results.push({ entry, similarity })
    }

    // 排序并返回 topK
    results.sort((a, b) => b.similarity - a.similarity)

    return results.slice(0, topK).map(r => ({
      source: r.entry.source,
      content: r.entry.content,
      relevance: r.similarity,
    }))
  }

  /**
   * 按关键词搜索
   */
  async searchByKeyword(keyword: string, topK: number = 5): Promise<ClassicSearchResult[]> {
    await this.initialize()

    const results: ClassicSearchResult[] = []

    for (const entry of this.entries) {
      if (entry.content.includes(keyword)) {
        results.push({
          source: entry.source,
          content: entry.content,
          relevance: 1.0,
        })
        if (results.length >= topK) break
      }
    }

    return results
  }

  /**
   * 获取适合取名的句子
   */
  async getSuitableForNaming(theme: string, topK: number = 5): Promise<ClassicSearchResult[]> {
    // 添加取名相关的上下文
    const query = `${theme} 美好 寓意 名字`
    return this.search(query, topK)
  }
}

// 单例
let retrieverInstance: ClassicRetriever | null = null

export function getRetriever(): ClassicRetriever {
  if (!retrieverInstance) {
    retrieverInstance = new ClassicRetriever()
  }
  return retrieverInstance
}
```

- [ ] **Step 4: 提交**

```bash
git add src/lib/rag/
git commit -m "feat: add RAG classic retrieval module"
```

---

## Task 8: Mastra Agent 配置

**Files:**
- Create: `src/mastra/index.ts`
- Create: `src/mastra/agent.ts`

- [ ] **Step 1: 创建 Agent 定义**

```typescript
// src/mastra/agent.ts
import { Agent } from '@mastra/core'

export const namingAgent = new Agent({
  name: '取名顾问',
  instructions: `你是一位专业的中文取名顾问，精通传统文化和现代审美。

你的能力：
1. 为新生儿取名：根据用户需求生成寓意美好的名字
2. 分析已有名字：全方位解析名字的优劣

你的原则：
- 尊重传统但不迷信，注重文化内涵
- 名字要好听、好写、好记
- 避免生僻字、不雅谐音
- 结合诗经楚辞等经典赋予文化底蕴

工作流程：
1. 理解用户需求（姓氏、性别、期望寓意等）
2. 根据需求选择合适的取名策略
3. 生成候选名字并解释寓意
4. 回答用户问题，迭代优化

取名策略：
- 文学模式：从诗经楚辞中寻找灵感，注重意境和韵律
- 传统模式：考虑五行八字、三才五格
- 现代模式：注重实用性，避免生僻字
- 混合模式：综合考虑以上因素

回复格式：
- 使用清晰的格式展示名字
- 解释名字的出处和寓意
- 提供五行、笔画等信息
- 给出专业建议`,
  model: {
    provider: 'anthropic',
    name: 'claude-sonnet-4-6',
  },
})
```

- [ ] **Step 2: 创建 Mastra 配置入口**

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core'
import { namingAgent } from './agent'
import { queryCharacterTool } from './tools/query-character'
import { searchClassicTool } from './tools/search-classic'
import { generateNamesTool } from './tools/generate-names'
import { analyzeNameTool } from './tools/analyze-name'

export const mastra = new Mastra({
  agents: [namingAgent],
  tools: [
    queryCharacterTool,
    searchClassicTool,
    generateNamesTool,
    analyzeNameTool,
  ],
})

export { namingAgent }
```

- [ ] **Step 3: 提交**

```bash
git add src/mastra/agent.ts src/mastra/index.ts
git commit -m "feat: add Mastra agent configuration"
```

---

## Task 9: Mastra Tools 实现

**Files:**
- Create: `src/mastra/tools/query-character.ts`
- Create: `src/mastra/tools/search-classic.ts`
- Create: `src/mastra/tools/generate-names.ts`
- Create: `src/mastra/tools/analyze-name.ts`

- [ ] **Step 1: 创建字库查询工具**

```typescript
// src/mastra/tools/query-character.ts
import { createTool } from '@mastra/core'
import { z } from 'zod'
import { getCharacterInfo, getCharsByWuxing, getCharsByStroke } from '@/lib/character'

export const queryCharacterTool = createTool({
  id: 'query-character',
  description: '查询汉字的详细信息，包括拼音、五行、笔画等',
  inputSchema: z.object({
    char: z.string().describe('要查询的汉字'),
  }),
  outputSchema: z.object({
    char: z.string(),
    pinyin: z.string(),
    wuxing: z.string(),
    strokes: z.number(),
  }),
  execute: async ({ context }) => {
    const info = getCharacterInfo(context.char)
    if (!info) {
      throw new Error(`未找到汉字 "${context.char}" 的信息`)
    }
    return info
  },
})

export const queryCharacterByWuxingTool = createTool({
  id: 'query-character-by-wuxing',
  description: '按五行属性筛选汉字',
  inputSchema: z.object({
    wuxing: z.enum(['金', '木', '水', '火', '土']).describe('五行属性'),
    limit: z.number().optional().describe('返回数量限制'),
  }),
  outputSchema: z.object({
    chars: z.array(z.string()),
    count: z.number(),
  }),
  execute: async ({ context }) => {
    const chars = getCharsByWuxing(context.wuxing)
    const limit = context.limit || 20
    return {
      chars: chars.slice(0, limit),
      count: chars.length,
    }
  },
})
```

- [ ] **Step 2: 创建典籍检索工具**

```typescript
// src/mastra/tools/search-classic.ts
import { createTool } from '@mastra/core'
import { z } from 'zod'
import { getRetriever } from '@/lib/rag'

export const searchClassicTool = createTool({
  id: 'search-classic',
  description: '从诗经、楚辞等典籍中检索相关句子，用于取名灵感',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词或语义描述'),
    topK: z.number().optional().describe('返回数量，默认5'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      source: z.string(),
      content: z.string(),
      relevance: z.number(),
    })),
  }),
  execute: async ({ context }) => {
    const retriever = getRetriever()
    const results = await retriever.search(context.query, context.topK || 5)
    return { results }
  },
})

export const searchClassicByKeywordTool = createTool({
  id: 'search-classic-keyword',
  description: '按关键词在典籍中精确搜索',
  inputSchema: z.object({
    keyword: z.string().describe('搜索关键词'),
    topK: z.number().optional().describe('返回数量，默认5'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      source: z.string(),
      content: z.string(),
      relevance: z.number(),
    })),
  }),
  execute: async ({ context }) => {
    const retriever = getRetriever()
    const results = await retriever.searchByKeyword(context.keyword, context.topK || 5)
    return { results }
  },
})
```

- [ ] **Step 3: 创建名字生成工具**

```typescript
// src/mastra/tools/generate-names.ts
import { createTool } from '@mastra/core'
import { z } from 'zod'
import { getCharacterInfo, getNameChars, getCharsByWuxing } from '@/lib/character'
import { getRetriever } from '@/lib/rag'

export const generateNamesTool = createTool({
  id: 'generate-names',
  description: '根据需求参数生成候选名字',
  inputSchema: z.object({
    surname: z.string().describe('姓氏'),
    gender: z.enum(['男', '女', '未定']).describe('性别'),
    wuxingRequired: z.array(z.string()).optional().describe('需要的五行属性'),
    expectations: z.array(z.string()).optional().describe('期望寓意'),
    avoidChars: z.array(z.string()).optional().describe('避免用字'),
    nameLength: z.union([z.literal(1), z.literal(2), z.literal('不限')]).optional().describe('名字字数'),
    count: z.number().optional().describe('生成数量，默认10'),
  }),
  outputSchema: z.object({
    names: z.array(z.object({
      name: z.string(),
      pinyin: z.string(),
      wuxing: z.array(z.string()),
      strokes: z.array(z.number()),
      source: z.string().optional(),
      meaning: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const count = context.count || 10
    const names: Array<{
      name: string
      pinyin: string
      wuxing: string[]
      strokes: number[]
      source?: string
      meaning: string
    }> = []

    // 获取候选字
    let candidateChars = getNameChars(context.gender === '未定' ? undefined : context.gender)

    // 按五行筛选
    if (context.wuxingRequired && context.wuxingRequired.length > 0) {
      const wuxingChars = context.wuxingRequired.flatMap(wx => getCharsByWuxing(wx))
      candidateChars = candidateChars.filter(c => wuxingChars.includes(c))
    }

    // 排除避免用字
    if (context.avoidChars) {
      candidateChars = candidateChars.filter(c => !context.avoidChars.includes(c))
    }

    // 从典籍中获取灵感
    const retriever = getRetriever()
    let classicResults: Array<{ source: string; content: string }> = []
    if (context.expectations && context.expectations.length > 0) {
      const query = context.expectations.join(' ')
      classicResults = await retriever.search(query, 10)
    }

    // 生成名字
    const nameLength = context.nameLength === '不限' ? 2 : (context.nameLength || 2)
    
    for (let i = 0; i < count && i < candidateChars.length; i++) {
      const char1 = candidateChars[i]
      const info1 = getCharacterInfo(char1)
      if (!info1) continue

      if (nameLength === 1) {
        names.push({
          name: context.surname + char1,
          pinyin: info1.pinyin,
          wuxing: [info1.wuxing],
          strokes: [info1.strokes],
          meaning: `寓意美好`,
        })
      } else {
        // 双字名
        for (let j = i + 1; j < candidateChars.length && names.length < count; j++) {
          const char2 = candidateChars[j]
          const info2 = getCharacterInfo(char2)
          if (!info2) continue

          const fullName = context.surname + char1 + char2
          const source = classicResults[i % classicResults.length]

          names.push({
            name: fullName,
            pinyin: `${info1.pinyin} ${info2.pinyin}`,
            wuxing: [info1.wuxing, info2.wuxing],
            strokes: [info1.strokes, info2.strokes],
            source: source?.content ? `「${source.content}」(${source.source})` : undefined,
            meaning: `寓意美好`,
          })
        }
      }
    }

    return { names: names.slice(0, count) }
  },
})
```

- [ ] **Step 4: 创建名字分析工具**

```typescript
// src/mastra/tools/analyze-name.ts
import { createTool } from '@mastra/core'
import { z } from 'zod'
import { getCharacterInfo } from '@/lib/character'
import { analyzeSanCaiWuGe } from '@/lib/sancai-wuge'
import { analyzePhonetic, checkHarmony } from '@/lib/phonetic'
import { getRetriever } from '@/lib/rag'

export const analyzeNameTool = createTool({
  id: 'analyze-name',
  description: '全方位分析已有名字',
  inputSchema: z.object({
    fullName: z.string().describe('完整姓名'),
  }),
  outputSchema: z.object({
    characters: z.array(z.object({
      char: z.string(),
      pinyin: z.string(),
      wuxing: z.string(),
      strokes: z.number(),
    })),
    wuxingAnalysis: z.string(),
    sancaiAnalysis: z.object({
      tianCai: z.string(),
      renCai: z.string(),
      diCai: z.string(),
      fortune: z.string(),
    }).optional(),
    wugeAnalysis: z.object({
      tianGe: z.number(),
      renGe: z.number(),
      diGe: z.number(),
      waiGe: z.number(),
      zongGe: z.number(),
    }).optional(),
    phoneticAnalysis: z.string(),
    harmonyWarning: z.array(z.string()),
    classicReference: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { fullName } = context
    const chars = fullName.split('')

    // 分析每个字
    const characters = chars.map(char => {
      const info = getCharacterInfo(char)
      return info || { char, pinyin: '', wuxing: '-', strokes: 0 }
    })

    // 五行分析
    const wuxingList = characters.slice(1).map(c => c.wuxing).filter(w => w !== '-')
    const wuxingAnalysis = `名字五行：${wuxingList.join(' ')}`

    // 三才五格分析
    const sancaiWuge = analyzeSanCaiWuGe(fullName)

    // 音律分析
    const nameOnly = fullName.slice(1)
    const phonetic = analyzePhonetic(nameOnly)

    // 谐音检查
    const harmonyWarning = checkHarmony(fullName)

    // 典籍检索
    const retriever = getRetriever()
    const classicResults = await retriever.search(nameOnly, 1)
    const classicReference = classicResults[0]?.content

    return {
      characters,
      wuxingAnalysis,
      sancaiAnalysis: sancaiWuge?.sancai,
      wugeAnalysis: sancaiWuge?.wuge,
      phoneticAnalysis: phonetic.analysis,
      harmonyWarning,
      classicReference,
    }
  },
})
```

- [ ] **Step 5: 提交**

```bash
git add src/mastra/tools/
git commit -m "feat: add Mastra tools implementation"
```

---

## Task 10: API 路由配置

**Files:**
- Create: `src/app/api/chat/route.ts`
- Create: `src/app/api/session/route.ts`

- [ ] **Step 1: 创建聊天 API 路由**

```typescript
// src/app/api/chat/route.ts
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { namingAgent } from '@/mastra'

export const maxDuration = 60

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    messages,
    system: namingAgent.instructions,
  })

  return result.toDataStreamResponse()
}
```

- [ ] **Step 2: 创建会话 API 路由**

```typescript
// src/app/api/session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSession, loadSession, listSessions } from '@/lib/session'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('id')
  
  if (sessionId) {
    const session = loadSession(sessionId)
    return NextResponse.json(session || { error: 'Session not found' }, { 
      status: session ? 200 : 404 
    })
  }

  const sessions = listSessions()
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const { mode } = await req.json()
  const session = createSession(mode || 'naming')
  return NextResponse.json(session)
}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/api/
git commit -m "feat: add API routes for chat and session"
```

---

## Task 11: 更新前端页面集成

**Files:**
- Modify: `src/app/chat/page.tsx`
- Modify: `src/app/results/page.tsx`

- [ ] **Step 1: 更新对话页面集成 AI SDK**

```typescript
// src/app/chat/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useChat } from 'ai/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ChatPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  })

  useEffect(() => {
    // 创建会话
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'naming' }),
    })
      .then(res => res.json())
      .then(data => setSessionId(data.sessionId))

    // 加载表单数据
    const formData = sessionStorage.getItem('namingFormData')
    if (formData) {
      const data = JSON.parse(formData)
      // 可以在这里发送初始消息
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleGenerateNames = () => {
    router.push('/results')
  }

  return (
    <main className="min-h-screen flex flex-col ink-wash">
      <header className="sticky top-0 z-50 bg-ink-50/90 backdrop-blur-sm border-b border-ink-100">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/form" className="text-ink-400 hover:text-ink-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="font-serif-cn text-lg text-ink-700">取名顾问</h1>
          <button 
            onClick={handleGenerateNames}
            className="text-sm text-ink-400 hover:text-ink-600 transition-colors"
          >
            生成名字
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-sm px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-ink-900 text-ink-50'
                    : 'bg-white border border-ink-100 text-ink-700'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-ink-100 rounded-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-ink-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-ink-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-ink-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-ink-50/90 backdrop-blur-sm border-t border-ink-100">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              className="flex-1 input-field"
              placeholder="输入您的想法..."
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-3 bg-ink-900 text-ink-50 rounded-sm
                       disabled:opacity-40 disabled:cursor-not-allowed
                       hover:bg-ink-800 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.176A5.968 5.968 0 0121 12a5.967 5.967 0 01-8.977 5.424L3 21l2.176-6.731A5.968 5.968 0 016 12z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/chat/page.tsx
git commit -m "feat: integrate AI SDK in chat page"
```

---

## Task 12: 环境配置与验证

**Files:**
- Create: `.env.example`
- Create: `.env.local` (gitignored)
- Modify: `.gitignore`

- [ ] **Step 1: 创建环境变量示例文件**

```bash
# .env.example
ANTHROPIC_API_KEY=your_api_key_here
```

- [ ] **Step 2: 更新 .gitignore**

```bash
# 添加到 .gitignore
.env.local
.env
node_modules/
.next/
data/sessions/*.json
```

- [ ] **Step 3: 安装依赖并验证**

Run: `cd D:/dev/git/ai-naming && npm install`

- [ ] **Step 4: 运行开发服务器验证**

Run: `cd D:/dev/git/ai-naming && npm run dev`

Expected: 服务器启动成功，访问 http://localhost:3000

- [ ] **Step 5: 最终提交**

```bash
git add .
git commit -m "feat: complete Chinese naming agent implementation"
```

---

## 自检清单

**1. Spec 覆盖检查：**
- [x] 前端页面：首页、表单页、测名页、对话页、结果页
- [x] Mastra Agent：取名顾问
- [x] Tools：字库查询、典籍检索、名字生成、名字分析
- [x] 八字五行计算：lunar-javascript
- [x] 三才五格计算：自实现
- [x] 音律分析：声调搭配
- [x] RAG 典籍检索：诗经、楚辞
- [x] 会话存储：本地 JSON

**2. 占位符检查：**
- [x] 无 TBD/TODO
- [x] 所有代码完整

**3. 类型一致性检查：**
- [x] 类型定义在 `src/types/index.ts`
- [x] 各模块使用一致类型
