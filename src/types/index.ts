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

// 增强音律结果
export interface PhoneticResult {
  pinyins: string[]
  tones: number[]
  toneNames: string[]
  toneAnalysis: string      // 声调评价
  rhymeAnalysis: string     // 韵母评价
  opennessAnalysis: string  // 开闭口音评价
  analysis: string          // 综合评价
  score: number             // 音律得分（满分20）
}

// 五行补益结果
export interface WuxingBenefitResult {
  xiYong: string[]      // 喜用神五行
  jiShen: string[]      // 忌神五行
  nameBenefit: string   // 名字对八字的补益说明
  score: number         // 补益得分（满分25）
}

// 五格单项详情
export interface WuGeDetailItem {
  num: number
  wuxing: string
  fortune: string   // 吉凶描述
  level: '大吉' | '吉' | '半吉' | '凶' | '大凶'
}

// 五格详情结果
export interface WuGeDetailResult {
  tianGe: WuGeDetailItem
  renGe: WuGeDetailItem
  diGe: WuGeDetailItem
  waiGe: WuGeDetailItem
  zongGe: WuGeDetailItem
  sancaiFortune: string
  sancaiLevel: '大吉' | '吉' | '半吉' | '凶' | '大凶'
  score: number  // 三才五格得分（满分20）
}

// 字形分析结果
export interface GlyphResult {
  strokeBalance: string   // 笔画平衡评价
  writingEase: string     // 书写便利评价
  visualStructure: string // 视觉结构评价
  rarity: string          // 生僻度评价
  score: number           // 字形得分（满分10）
}

// 重名率结果
export interface PopularityResult {
  level: '极低' | '低' | '中等' | '高' | '极高'
  count: number           // 词频出现次数
  homophoneCount: number  // 同音名数量
  score: number           // 时代适用得分（满分5）
}
