'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import DebugPanel from '@/components/DebugPanel'
import NameScoreCard from '@/components/NameScoreCard'
import type { AnalysisStep } from '@/types/analysis-events'

interface StepState {
  status: 'pending' | 'running' | 'done' | 'error'
  duration?: number
  summary?: string
  detail?: Record<string, unknown>
  prompt?: string
  systemPrompt?: string
  chunks?: string
  result?: string
  error?: string
}

type ViewMode = 'card' | 'detail' | 'compare'

interface NameResult {
  name: string
  pinyin: string
  source?: string
  meaning: string
  wuxing: string[]
  strokes: number[]
  nameId?: number
  analysis?: {
    wuxingDetail?: string
    sancai?: string
    phonetic?: string
    classicReference?: string
    harmonyWarning?: string[]
  }
  scores?: {
    wuxingBenefit?: number
    sancaiWuge?: number
    phonetic?: number
    glyph?: number
    popularity?: number
  }
  aiAnalysis?: string
}

// 注音符号转拼音映射表
const BOPOMOFO_TO_PINYIN: Record<string, string> = {
  // 声母
  'ㄅ': 'b', 'ㄆ': 'p', 'ㄇ': 'm', 'ㄈ': 'f',
  'ㄉ': 'd', 'ㄊ': 't', 'ㄋ': 'n', 'ㄌ': 'l',
  'ㄍ': 'g', 'ㄎ': 'k', 'ㄏ': 'h',
  'ㄐ': 'j', 'ㄑ': 'q', 'ㄒ': 'x',
  'ㄓ': 'zh', 'ㄔ': 'ch', 'ㄕ': 'sh', 'ㄖ': 'r',
  'ㄗ': 'z', 'ㄘ': 'c', 'ㄙ': 's',
  // 韵母
  'ㄚ': 'a', 'ㄛ': 'o', 'ㄜ': 'e', 'ㄝ': 'e',
  'ㄞ': 'ai', 'ㄟ': 'ei', 'ㄠ': 'ao', 'ㄡ': 'ou',
  'ㄢ': 'an', 'ㄣ': 'en', 'ㄤ': 'ang', 'ㄥ': 'eng',
  'ㄦ': 'er',
  'ㄧ': 'i', 'ㄨ': 'u', 'ㄩ': 'ü',
  // 介音组合
  'ㄧㄚ': 'ia', 'ㄧㄝ': 'ie', 'ㄧㄠ': 'iao', 'ㄧㄡ': 'iu',
  'ㄧㄢ': 'ian', 'ㄧㄣ': 'in', 'ㄧㄤ': 'iang', 'ㄧㄥ': 'ing',
  'ㄨㄚ': 'ua', 'ㄨㄛ': 'uo', 'ㄨㄞ': 'uai', 'ㄨㄟ': 'ui',
  'ㄨㄢ': 'uan', 'ㄨㄣ': 'un', 'ㄨㄤ': 'uang', 'ㄨㄥ': 'ong',
  'ㄩㄝ': 'ue', 'ㄩㄢ': 'uan', 'ㄩㄣ': 'un', 'ㄩㄥ': 'iong',
}

// 声调符号映射
const TONE_MARKS: Record<string, number> = {
  'ˊ': 2, 'ˇ': 3, 'ˋ': 4, '˙': 5
}

/**
 * 将注音符号转换为拼音
 * 例如: "ㄖㄨㄢˇ" -> "ruǎn"
 */
function bopomofoToPinyin(bopomofo: string): string {
  if (!bopomofo) return ''

  // 如果已经是拼音格式（包含字母），直接返回
  if (/[a-zA-Z]/.test(bopomofo)) {
    return bopomofo
  }

  let result = ''
  let tone = 1
  let i = 0

  // 提取声调
  const lastChar = bopomofo.slice(-1)
  if (TONE_MARKS[lastChar]) {
    tone = TONE_MARKS[lastChar] === 5 ? 0 : TONE_MARKS[lastChar]
    bopomofo = bopomofo.slice(0, -1)
  }

  // 尝试匹配双字符韵母
  while (i < bopomofo.length) {
    let matched = false

    // 尝试匹配两个字符的组合
    if (i + 1 < bopomofo.length) {
      const twoChar = bopomofo.slice(i, i + 2)
      if (BOPOMOFO_TO_PINYIN[twoChar]) {
        result += BOPOMOFO_TO_PINYIN[twoChar]
        i += 2
        matched = true
      }
    }

    // 单字符匹配
    if (!matched) {
      const char = bopomofo[i]
      if (BOPOMOFO_TO_PINYIN[char]) {
        result += BOPOMOFO_TO_PINYIN[char]
      }
      i++
    }
  }

  // 添加声调
  if (tone > 0 && result) {
    const toneChars = ['ā', 'á', 'ǎ', 'à']
    const vowels = ['a', 'e', 'o', 'i', 'u', 'ü', 'ā', 'ē', 'ō', 'ī', 'ū', 'ǖ']

    // 找到主要元音并添加声调
    let vowelIndex = -1
    for (let j = 0; j < result.length; j++) {
      if (vowels.includes(result[j].toLowerCase())) {
        vowelIndex = j
        // 优先在后面的元音上标调（除了 iu, ui）
        if (result.toLowerCase().includes('iu') || result.toLowerCase().includes('ui')) {
          if (result[j].toLowerCase() === 'u' || result[j].toLowerCase() === 'i') {
            continue
          }
        }
      }
    }

    if (vowelIndex >= 0) {
      const vowel = result[vowelIndex]
      const vowelWithTone: Record<string, string[]> = {
        'a': ['ā', 'á', 'ǎ', 'à'],
        'e': ['ē', 'é', 'ě', 'è'],
        'i': ['ī', 'í', 'ǐ', 'ì'],
        'o': ['ō', 'ó', 'ǒ', 'ò'],
        'u': ['ū', 'ú', 'ǔ', 'ù'],
        'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
      }
      const tonedVowel = vowelWithTone[vowel.toLowerCase()]?.[tone - 1] || vowel
      result = result.slice(0, vowelIndex) + tonedVowel + result.slice(vowelIndex + 1)
    }
  }

  return result
}

// 简单的 Markdown 渲染
function renderMarkdown(text: string): string {
  return text
    // 粗体 **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 标题 ### text
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-ink-800 mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-ink-800 mt-4 mb-2 text-base">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-semibold text-ink-800 mt-4 mb-2">$1</h2>')
    // 列表 - item 或 * item
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-ink-600">$1</li>')
    // 数字列表 1. item
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-ink-600">$2</li>')
    // 换行
    .replace(/\n/g, '<br/>')
}

// 模拟数据
const mockNames: NameResult[] = [
  {
    name: '李婉清',
    pinyin: 'Lǐ Wǎn Qīng',
    source: '有美一人，清扬婉兮',
    meaning: '温婉美好，清雅脱俗',
    wuxing: ['木', '土', '水'],
    strokes: [7, 11, 11],
    analysis: {
      wuxingDetail: '五行相生，土木相配，土水相济',
      sancai: '三才配置：木土水，成功运被压抑',
      phonetic: '上声上声阴平，音律和谐优美',
      classicReference: '出自《诗经·郑风·野有蔓草》："有美一人，清扬婉兮"',
    },
  },
  {
    name: '李思齐',
    pinyin: 'Lǐ Sī Qí',
    source: '见贤思齐焉',
    meaning: '向贤者学习，追求进步',
    wuxing: ['木', '金', '水'],
    strokes: [7, 9, 14],
    analysis: {
      wuxingDetail: '五行流通，金生水，水生木',
      sancai: '三才配置：木金水，可得平安',
      phonetic: '上声阴平阳平，声调起伏有致',
      classicReference: '出自《论语·里仁》："见贤思齐焉，见不贤而内自省也"',
    },
  },
  {
    name: '李沐阳',
    pinyin: 'Lǐ Mù Yáng',
    source: '沐浴阳光，向阳而生',
    meaning: '温暖阳光，积极向上',
    wuxing: ['木', '水', '土'],
    strokes: [7, 8, 12],
    analysis: {
      wuxingDetail: '水木相生，土木相配',
      sancai: '三才配置：木水土，成功运佳',
      phonetic: '上声去声阳平，朗朗上口',
    },
  },
]

// 分析进度步骤（8步）
const ANALYSIS_STEPS = [
  { key: 'chars', label: '解析汉字信息', duration: 500 },
  { key: 'wuxing', label: '计算八字五行', duration: 300 },
  { key: 'benefit', label: '分析五行补益', duration: 400 },
  { key: 'sancai', label: '分析三才五格', duration: 400 },
  { key: 'phonetic', label: '分析音律搭配', duration: 300 },
  { key: 'glyph', label: '分析字形结构', duration: 300 },
  { key: 'popularity', label: '检查重名率', duration: 200 },
  { key: 'ai', label: 'AI深度分析', duration: 60000 },
]

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen ink-wash flex items-center justify-center"><p className="text-ink-400">加载中...</p></div>}>
      <ResultsContent />
    </Suspense>
  )
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'naming'
  const name = searchParams.get('name')

  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [names, setNames] = useState<NameResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showDebug, setShowDebug] = useState(false)
  const [steps, setSteps] = useState<Record<string, StepState>>({})
  const [nameId, setNameId] = useState<number | undefined>(undefined)
  const hasRunRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // 防止 StrictMode 重复执行
    if (hasRunRef.current) return
    hasRunRef.current = true

    const runAnalysis = async () => {
      if (mode === 'analyze' && name) {
        setIsLoading(true)
        setError(null)
        setCurrentStep(0)
        setElapsedTime(0)

        // 启动计时器
        timerRef.current = setInterval(() => {
          setElapsedTime(prev => prev + 1)
        }, 1000)

        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => {
            controller.abort()
          }, 120000)

          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name }),
            signal: controller.signal,
          })

          if (!response.ok) throw new Error(`分析请求失败: ${response.status}`)

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          if (!reader) throw new Error('No reader')

          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const json = line.slice(6)
              if (!json) continue
              try {
                const event = JSON.parse(json)
                if (event.type === 'complete') {
                  const data = event.data
                  // 转换注音为拼音
                  const convertedPinyin = data.charInfos?.map((c: any) => {
                    const pinyin = c.pinyin || ''
                    if (pinyin && /[\u3100-\u312F]/.test(pinyin)) return bopomofoToPinyin(pinyin)
                    return pinyin
                  }).filter(Boolean).join(' ') || ''
                  const result: NameResult = {
                    name: data.name as string,
                    pinyin: convertedPinyin,
                    meaning: '',
                    wuxing: data.charInfos?.slice(1).map((c: { wuxing: string }) => c.wuxing).filter((w: string) => w !== '-') || [],
                    strokes: data.charInfos?.map((c: { strokes: number }) => c.strokes) || [],
                    nameId: data.nameId as number | undefined,
                    analysis: {
                      sancai: data.sancaiWuge ? `天格${data.sancaiWuge.wuge.tianGe} 人格${data.sancaiWuge.wuge.renGe} 地格${data.sancaiWuge.wuge.diGe} 外格${data.sancaiWuge.wuge.waiGe} 总格${data.sancaiWuge.wuge.zongGe}` : undefined,
                      phonetic: data.phonetic?.analysis,
                      harmonyWarning: data.harmonyWarnings,
                    },
                    scores: {
                      wuxingBenefit: data.wuxingBenefit?.score,
                      sancaiWuge: data.sancaiWugeEnhanced?.score,
                      phonetic: data.phonetic?.score,
                      glyph: data.glyph?.score,
                      popularity: data.popularity?.score,
                    },
                    aiAnalysis: data.analysis as string,
                  }
                  setNames([result])
                } else if (event.step) {
                  setSteps(prev => {
                    const next = { ...prev }
                    const stepState = { ...(next[event.step] || { status: 'pending' as const }) }
                    stepState.status = event.status
                    if (event.duration != null) stepState.duration = event.duration
                    if (event.summary) stepState.summary = event.summary
                    if (event.detail) stepState.detail = event.detail
                    if (event.prompt) stepState.prompt = event.prompt
                    if (event.systemPrompt) stepState.systemPrompt = event.systemPrompt
                    if (event.chunk) stepState.chunks = (stepState.chunks || '') + event.chunk
                    if (event.result) stepState.result = event.result
                    if (event.error) stepState.error = event.error
                    next[event.step] = stepState
                    return next
                  })
                  const stepKeys: AnalysisStep[] = ['chars', 'wuxing', 'benefit', 'sancai', 'phonetic', 'harmony', 'glyph', 'popularity', 'prompt', 'ai']
                  const idx = stepKeys.indexOf(event.step)
                  if (idx >= 0) setCurrentStep(idx)
                }
              } catch { /* ignore parse errors */ }
            }
          }

          clearTimeout(timeoutId)
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            setError('请求超时，请稍后重试')
          } else {
            setError('名字分析失败，请稍后重试')
          }
          setNames([{
            name: name,
            pinyin: '',
            meaning: '分析失败',
            wuxing: [],
            strokes: [],
          }])
        } finally {
          if (timerRef.current) {
            clearInterval(timerRef.current)
          }
          setIsLoading(false)
        }
      } else if (mode === 'naming') {
        // Read pipeline results from sessionStorage
        const pipelineResultsStr = sessionStorage.getItem('namingPipelineResults')
        if (pipelineResultsStr) {
          try {
            const pipelineResults = JSON.parse(pipelineResultsStr)
            const realNames: NameResult[] = (pipelineResults.names || []).map((n: any) => ({
              name: n.name,
              pinyin: n.pinyin,
              source: n.classicSource,
              meaning: n.meaningText || '',
              wuxing: n.wuxingTags || [],
              strokes: n.strokes || [],
              nameId: n.nameId,
              scores: n.scores,
              analysis: {
                harmonyWarning: n.harmonyWarnings,
              },
            }))
            setNames(realNames.length > 0 ? realNames : mockNames)
          } catch {
            setNames(mockNames)
          }
        } else {
          setNames(mockNames)
        }
      }
    }

    runAnalysis()

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [mode, name])

  const toggleSelect = (name: string) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  return (
    <main className="min-h-screen ink-wash">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-ink-50/90 backdrop-blur-sm border-b border-ink-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-ink-400 hover:text-ink-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="font-serif-cn text-lg text-ink-700">
            {mode === 'analyze' ? '名字分析' : '取名结果'}
          </h1>
          <button className="text-sm text-ink-400 hover:text-ink-600 transition-colors">
            保存
          </button>
        </div>
      </header>

      {/* 加载状态 - 带进度展示 */}
      {isLoading && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="card-elegant p-8">
            {/* 名字显示 */}
            <div className="text-center mb-8">
              <h2 className="font-serif-cn text-4xl text-ink-900 tracking-wider mb-2">
                {name}
              </h2>
              <p className="text-ink-400 text-sm">正在分析中...</p>
            </div>

            {/* 进度条 */}
            <div className="mb-6">
              <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-ink-600 transition-all duration-300"
                  style={{ width: `${((currentStep + 0.5) / ANALYSIS_STEPS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* 步骤列表 */}
            <div className="space-y-3">
              {ANALYSIS_STEPS.map((step, index) => (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 p-3 rounded-sm transition-all ${
                    index < currentStep
                      ? 'bg-jade-50 text-jade-700'
                      : index === currentStep
                      ? 'bg-ink-100 text-ink-800'
                      : 'text-ink-400'
                  }`}
                >
                  <span className="w-6 h-6 flex items-center justify-center">
                    {index < currentStep ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-jade-500">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    ) : index === currentStep ? (
                      <div className="w-4 h-4 border-2 border-ink-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-ink-300" />
                    )}
                  </span>
                  <span className="flex-1">{step.label}</span>
                  {index === currentStep && (
                    <span className="text-sm text-ink-500">{elapsedTime}s</span>
                  )}
                </div>
              ))}
            </div>

            {/* 提示信息 */}
            <p className="text-center text-ink-400 text-sm mt-6">
              AI深度分析需要约30-60秒，请耐心等待...
            </p>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-red-700">
            {error}
          </div>
        </div>
      )}

      {/* 视图切换 */}
      {mode === 'naming' && !isLoading && (
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-ink-100 rounded-sm p-1">
              {[
                { key: 'card', label: '卡片' },
                { key: 'detail', label: '详细' },
                { key: 'compare', label: '对比' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key as ViewMode)}
                  className={`px-4 py-1.5 text-sm rounded-sm transition-all
                    ${viewMode === key
                      ? 'bg-white text-ink-800 shadow-sm'
                      : 'text-ink-500 hover:text-ink-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-sm text-ink-400">共 {names.length} 个名字</span>
          </div>
        </div>
      )}

      {/* 内容区域 */}
      {!isLoading && names.length > 0 && (
        <div className="max-w-3xl mx-auto px-6 pb-8">
          {/* 分析模式：显示 AI 分析结果 */}
          {mode === 'analyze' && names[0]?.aiAnalysis && (
            <div className="space-y-6">
              {/* 名字标题 */}
              <div className="card-elegant p-6 text-center">
                <h2 className="font-serif-cn text-4xl text-ink-900 tracking-wider mb-2">
                  {names[0].name}
                </h2>
                <p className="text-ink-400">{names[0].pinyin}</p>
                {names[0].wuxing.length > 0 && (
                  <div className="flex justify-center gap-1 mt-3">
                    {names[0].wuxing.map((w, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded-sm text-xs
                          ${w === '金' ? 'bg-ink-100 text-ink-700' : ''}
                          ${w === '木' ? 'bg-emerald-50 text-emerald-700' : ''}
                          ${w === '水' ? 'bg-blue-50 text-blue-700' : ''}
                          ${w === '火' ? 'bg-red-50 text-red-700' : ''}
                          ${w === '土' ? 'bg-amber-50 text-amber-700' : ''}
                        `}
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                )}
                {/* 评分概览 */}
                {names[0].scores && (
                  <div className="flex justify-center flex-wrap gap-2 mt-3 text-xs text-ink-500">
                    {names[0].scores.wuxingBenefit != null && (
                      <span className="px-2 py-0.5 bg-ink-50 rounded-sm">五行 {names[0].scores.wuxingBenefit}/25</span>
                    )}
                    {names[0].scores.sancaiWuge != null && (
                      <span className="px-2 py-0.5 bg-ink-50 rounded-sm">三才 {names[0].scores.sancaiWuge}/20</span>
                    )}
                    {names[0].scores.phonetic != null && (
                      <span className="px-2 py-0.5 bg-ink-50 rounded-sm">音律 {names[0].scores.phonetic}/20</span>
                    )}
                    {names[0].scores.glyph != null && (
                      <span className="px-2 py-0.5 bg-ink-50 rounded-sm">字形 {names[0].scores.glyph}/10</span>
                    )}
                    {names[0].scores.popularity != null && (
                      <span className="px-2 py-0.5 bg-ink-50 rounded-sm">时代 {names[0].scores.popularity}/5</span>
                    )}
                  </div>
                )}
              </div>

              {/* AI 分析内容 */}
              <div className="card-elegant p-6">
                <div
                  className="text-sm leading-relaxed prose prose-sm max-w-none text-ink-700"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(names[0].aiAnalysis) }}
                />
              </div>

              {/* 记忆偏好 */}
              {mode === 'analyze' && !isLoading && names[0] && (
                <div className="card-elegant p-4 flex items-center gap-4">
                  <span className="text-sm text-ink-500">已保存到记忆</span>
                  <div className="flex gap-2">
                    {(['liked', 'neutral', 'disliked'] as const).map(pref => (
                      <button
                        key={pref}
                        onClick={() => {
                          if (names[0]?.nameId) {
                            fetch(`/api/names/${names[0].nameId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ preference: pref }),
                            })
                          }
                        }}
                        className={`px-3 py-1 rounded-sm text-sm ${pref === 'liked' ? 'bg-jade-50 text-jade-700' : pref === 'disliked' ? 'bg-red-50 text-red-700' : 'bg-ink-50 text-ink-600'}`}
                      >
                        {pref === 'liked' ? '喜欢' : pref === 'disliked' ? '不喜欢' : '一般'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 取名模式：卡片视图 */}
          {mode === 'naming' && viewMode === 'card' && (
            <div className="space-y-4">
              {names.map((item) => (
                item.scores ? (
                  <NameScoreCard
                    key={item.name}
                    data={{
                      name: item.name,
                      surname: item.name.charAt(0),
                      givenName: item.name.slice(1),
                      pinyin: item.pinyin,
                      scores: item.scores as any,
                      totalScore: Object.values(item.scores).reduce((sum: number, s: any) => sum + (s || 0), 0),
                      wuxingTags: item.wuxing,
                      strokes: item.strokes,
                      classicSource: item.source,
                      meaningText: item.meaning,
                      harmonyWarnings: item.analysis?.harmonyWarning,
                      nameId: item.nameId,
                    }}
                    onSelect={toggleSelect}
                    selected={selectedNames.includes(item.name)}
                  />
                ) : (
                  <div key={item.name} className="card-elegant p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-serif-cn text-3xl text-ink-900 tracking-wider">{item.name}</h3>
                        <p className="text-ink-400 text-sm mt-1">{item.pinyin}</p>
                      </div>
                    </div>
                    {item.source && <p className="text-vermilion-600 text-sm mb-2 font-light italic">「{item.source}」</p>}
                    <p className="text-ink-600 mb-4">{item.meaning}</p>
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-ink-400">五行</span>
                        <div className="flex gap-1">
                          {item.wuxing.map((w, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded-sm text-xs ${w === '金' ? 'bg-ink-100 text-ink-700' : w === '木' ? 'bg-emerald-50 text-emerald-700' : w === '水' ? 'bg-blue-50 text-blue-700' : w === '火' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{w}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-ink-400">笔画</span>
                        <span className="text-ink-600">{item.strokes.join('-')}</span>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* 取名模式：详细视图 */}
          {mode === 'naming' && viewMode === 'detail' && (
            <div className="space-y-6">
              {names.map((item, index) => (
                <div
                  key={item.name}
                  className="card-elegant p-8"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="text-center mb-6 pb-6 border-b border-ink-100">
                    <h3 className="font-serif-cn text-4xl text-ink-900 tracking-wider mb-2">
                      {item.name}
                    </h3>
                    <p className="text-ink-400">{item.pinyin}</p>
                  </div>

                  {item.analysis && (
                    <div className="space-y-4">
                      {item.analysis.classicReference && (
                        <div>
                          <h4 className="text-sm text-ink-500 mb-1">诗词典故</h4>
                          <p className="text-ink-700">{item.analysis.classicReference}</p>
                        </div>
                      )}
                      {item.analysis.wuxingDetail && (
                        <div>
                          <h4 className="text-sm text-ink-500 mb-1">五行分析</h4>
                          <p className="text-ink-700">{item.analysis.wuxingDetail}</p>
                        </div>
                      )}
                      {item.analysis.sancai && (
                        <div>
                          <h4 className="text-sm text-ink-500 mb-1">三才五格</h4>
                          <p className="text-ink-700">{item.analysis.sancai}</p>
                        </div>
                      )}
                      {item.analysis.phonetic && (
                        <div>
                          <h4 className="text-sm text-ink-500 mb-1">音律分析</h4>
                          <p className="text-ink-700">{item.analysis.phonetic}</p>
                        </div>
                      )}
                      {item.analysis.harmonyWarning && item.analysis.harmonyWarning.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-sm p-3">
                          <h4 className="text-sm text-amber-700 mb-1">谐音提示</h4>
                          <p className="text-amber-600 text-sm">
                            {item.analysis.harmonyWarning.join('、')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 取名模式：对比视图 */}
          {mode === 'naming' && viewMode === 'compare' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200">
                    <th className="text-left py-3 px-4 font-medium text-ink-500">名字</th>
                    <th className="text-left py-3 px-4 font-medium text-ink-500">拼音</th>
                    <th className="text-left py-3 px-4 font-medium text-ink-500">五行</th>
                    <th className="text-left py-3 px-4 font-medium text-ink-500">笔画</th>
                    <th className="text-left py-3 px-4 font-medium text-ink-500">寓意</th>
                  </tr>
                </thead>
                <tbody>
                  {names.map((item) => (
                    <tr key={item.name} className="border-b border-ink-100 hover:bg-white/50">
                      <td className="py-4 px-4 font-serif-cn text-lg text-ink-900">{item.name}</td>
                      <td className="py-4 px-4 text-ink-500">{item.pinyin}</td>
                      <td className="py-4 px-4">
                        <div className="flex gap-1">
                          {item.wuxing.map((w, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 bg-ink-100 text-ink-600 text-xs rounded-sm"
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-ink-500">{item.strokes.join('-')}</td>
                      <td className="py-4 px-4 text-ink-600 max-w-xs truncate">{item.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 底部操作 */}
          {mode === 'naming' && (
            <div className="mt-8 flex gap-4">
              <button className="flex-1 btn-secondary">
                继续对话优化
              </button>
              <button className="flex-1 btn-primary">
                重新生成
              </button>
            </div>
          )}
        </div>
      )}
      {/* Debug panel toggle */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="fixed right-4 top-20 z-50 p-2 rounded-sm bg-gray-800 text-gray-300 hover:bg-gray-700"
        title="调试面板"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L17.25 17.25M6.75 17.25L6.75 6.75M3.75 12L20.25 12" />
        </svg>
      </button>
      {showDebug && (
        <div className="fixed right-0 top-0 h-full w-[40%] z-40 shadow-xl">
          <DebugPanel steps={steps} totalTime={Object.values(steps).reduce((sum, s) => sum + (s.duration || 0), 0)} />
        </div>
      )}
    </main>
  )
}
