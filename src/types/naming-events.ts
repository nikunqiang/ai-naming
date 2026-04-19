// src/types/naming-events.ts

/** 候选字池 */
export interface CandidateCharPool {
  primary: string[]    // 喜用神匹配的字
  secondary: string[]  // 其他常用字
  xiYong: string[]     // 喜用神五行
  jiShen: string[]     // 忌神五行
}

/** 六维评分 */
export interface NameScores {
  wuxingBenefit: number  // /25
  sancaiWuge: number     // /20
  phonetic: number       // /20
  meaning: number        // /20
  glyph: number          // /10
  popularity: number     // /5
}

/** 评分后的名字 */
export interface ScoredName {
  name: string
  surname: string
  givenName: string
  pinyin: string
  scores: NameScores
  totalScore: number
  wuxingTags: string[]
  strokes: number[]
  classicSource?: string
  meaningText?: string
  harmonyWarnings?: string[]
  nameId?: number
}

/** 流水线阶段 */
export type NamingStep = 'filtering' | 'rag' | 'generating' | 'scoring'

/** 阶段进度事件 */
export interface NamingStepEvent {
  step: NamingStep
  status: 'running' | 'done'
  duration?: number
  summary?: string
  detail?: Record<string, unknown>
  chunk?: string
}

/** 完成事件 */
export interface NamingCompleteEvent {
  type: 'complete'
  data: {
    names: ScoredName[]
    candidateChars?: CandidateCharPool
  }
}

/** 流水线请求 */
export interface NamingRequest {
  surname: string
  gender: '男' | '女' | '未定'
  birthTime?: string
  expectations?: string
  avoidChars?: string
  namingMode: '传统' | '文学' | '现代' | '混合'
  nameLength?: 1 | 2 | '不限'
  motherSurname?: string
}
