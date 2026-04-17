// src/types/analysis-events.ts

/** 分析步骤名称 */
export type AnalysisStep =
  | 'chars' | 'wuxing' | 'benefit' | 'sancai'
  | 'phonetic' | 'harmony' | 'glyph' | 'popularity'
  | 'prompt' | 'ai'

/** SSE 步骤事件 */
export interface StepEvent {
  step: AnalysisStep
  status: 'running' | 'done' | 'error'
  duration?: number
  summary?: string
  detail?: Record<string, unknown>
  prompt?: string
  systemPrompt?: string
  chunk?: string
  result?: string
  error?: string
}

/** SSE 完成事件 */
export interface CompleteEvent {
  type: 'complete'
  data: Record<string, unknown>
}

/** 联合类型 */
export type AnalysisEvent = StepEvent | CompleteEvent

/** 步骤中文标签映射 */
export const STEP_LABELS: Record<AnalysisStep, string> = {
  chars: '解析汉字信息',
  wuxing: '计算八字五行',
  benefit: '分析五行补益',
  sancai: '分析三才五格',
  phonetic: '分析音律搭配',
  harmony: '检查谐音',
  glyph: '分析字形结构',
  popularity: '检查重名率',
  prompt: '构建提示词',
  ai: 'AI深度分析',
}
