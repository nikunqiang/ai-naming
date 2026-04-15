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
