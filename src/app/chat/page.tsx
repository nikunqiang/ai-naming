'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import NameScoreCard from '@/components/NameScoreCard'
import type { ScoredName, CandidateCharPool } from '@/types/naming-events'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface FormData {
  surname: string
  motherSurname?: string
  gender: '男' | '女' | '未定' | ''
  birthTime?: string
  expectations?: string
  avoidChars?: string
  namingMode: '传统' | '文学' | '现代' | '混合'
  nameLength?: 1 | 2 | '不限'
}

const PIPELINE_STEPS = [
  { key: 'filtering', label: '命理筛选候选字' },
  { key: 'rag', label: '检索诗词典故' },
  { key: 'generating', label: 'AI生成名字' },
  { key: 'scoring', label: '六维评分验证' },
] as const

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-ink-800 mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-ink-800 mt-4 mb-2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-semibold text-ink-800 mt-4 mb-2">$1</h2>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-ink-600">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-ink-600">$2</li>')
    .replace(/\n/g, '<br/>')
}

export default function ChatPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<string>('')
  const initializedRef = useRef(false)
  const userScrolledUp = useRef(false)

  // Pipeline state
  const [scoredNames, setScoredNames] = useState<ScoredName[]>([])
  const [pipelineStage, setPipelineStage] = useState<number>(-1)
  const [pipelineStepStatus, setPipelineStepStatus] = useState<Record<string, { status: string; summary?: string }>>({})
  const [candidateChars, setCandidateChars] = useState<CandidateCharPool | undefined>()
  const [generatingText, setGeneratingText] = useState('')
  const pipelineFormData = useRef<FormData | null>(null)

  useEffect(() => {
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'naming' }),
    })
      .then(res => res.json())
      .then(data => setSessionId(data.sessionId))
  }, [])

  // Track if user scrolled up manually
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
      userScrolledUp.current = !atBottom
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-scroll only when user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, scoredNames])

  // Auto-trigger naming pipeline on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const formDataStr = sessionStorage.getItem('namingFormData')
    if (!formDataStr) return

    const formData: FormData = JSON.parse(formDataStr)
    if (!formData.surname || !formData.gender) return

    pipelineFormData.current = formData

    const parts: string[] = []
    parts.push(`我想为姓${formData.surname}的${formData.gender === '未定' ? '宝宝' : formData.gender}孩取名。`)
    if (formData.expectations) parts.push(`期望寓意：${formData.expectations}。`)
    parts.push(`取名模式：${formData.namingMode}。`)

    const displayMsg = parts.join('')
    setMessages(prev => [...prev, { id: `user_${Date.now()}`, role: 'user', content: displayMsg }])

    setTimeout(() => {
      runNamingPipeline(formData)
    }, 300)
  }, [])

  /** Run the four-stage naming pipeline */
  async function runNamingPipeline(formData: FormData) {
    setIsLoading(true)
    setPipelineStage(0)
    setScoredNames([])
    setGeneratingText('')

    try {
      const response = await fetch('/api/naming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surname: formData.surname,
          gender: formData.gender,
          birthTime: formData.birthTime,
          expectations: formData.expectations,
          avoidChars: formData.avoidChars,
          namingMode: formData.namingMode,
          nameLength: formData.nameLength,
          motherSurname: formData.motherSurname,
        }),
      })

      if (!response.ok) throw new Error('Pipeline request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
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
              const names: ScoredName[] = event.data.names || []
              setScoredNames(names)
              setCandidateChars(event.data.candidateChars)

              // Save to sessionStorage for results page
              sessionStorage.setItem('namingPipelineResults', JSON.stringify({ names }))

              const summary = names.length > 0
                ? `为您推荐了${names.length}个名字，请查看下方评分卡片。`
                : '未能生成符合条件的名字，请调整需求后重试。'
              setMessages(prev => [...prev, { id: `assistant_${Date.now()}`, role: 'assistant', content: summary }])
            } else if (event.step) {
              const stepIdx = PIPELINE_STEPS.findIndex(s => s.key === event.step)
              if (stepIdx >= 0) setPipelineStage(stepIdx)

              setPipelineStepStatus(prev => ({
                ...prev,
                [event.step]: { status: event.status, summary: event.summary },
              }))

              if (event.step === 'generating' && event.chunk) {
                setGeneratingText(prev => prev + event.chunk)
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (error) {
      console.error('Pipeline error:', error)
      setMessages(prev => [...prev, { id: `assistant_${Date.now()}`, role: 'assistant', content: '取名服务暂时不可用，请稍后重试。' }])
    } finally {
      setIsLoading(false)
      setPipelineStage(-1)
    }
  }

  /** Send chat message (for refinement after pipeline) */
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: content.trim(),
    }

    const assistantId = `assistant_${Date.now()}`
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    contentRef.current = ''

    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    // Build clean chat history: only user/assistant exchanges after pipeline
    // Exclude pipeline summary messages to avoid confusing the LLM
    const chatHistory = messages
      .filter(m => m.content !== '')
      .map(m => ({ role: m.role, content: m.content }))

    // Ensure alternating user/assistant roles (merge consecutive same-role messages)
    const mergedHistory: Array<{ role: string; content: string }> = []
    for (const m of chatHistory) {
      const last = mergedHistory[mergedHistory.length - 1]
      if (last && last.role === m.role) {
        last.content += '\n' + m.content
      } else {
        mergedHistory.push({ ...m })
      }
    }

    // Ensure first message is from user
    if (mergedHistory.length > 0 && mergedHistory[0].role !== 'user') {
      mergedHistory.shift()
    }

    // Build system context from pipeline results
    const fd = pipelineFormData.current
    const contextParts: string[] = []
    if (fd) {
      contextParts.push(`用户为姓${fd.surname}的${fd.gender === '未定' ? '宝宝' : fd.gender}孩取名，模式：${fd.namingMode}。`)
      if (fd.expectations) contextParts.push(`期望：${fd.expectations}`)
    }
    if (scoredNames.length > 0) {
      contextParts.push(`已推荐名字：${scoredNames.map(n => `${n.name}(${n.totalScore}分)`).join('、')}。`)
    }
    if (candidateChars) {
      contextParts.push(`候选字池：${[...candidateChars.primary, ...candidateChars.secondary].slice(0, 30).join('、')}。`)
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...mergedHistory,
            { role: 'user' as const, content: userMessage.content },
          ],
          pipelineContext: contextParts.length > 0 ? contextParts.join('') : undefined,
        }),
      })

      if (!response.ok) throw new Error('API request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const text = JSON.parse(line.slice(2))
              contentRef.current += text
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: contentRef.current } : m))
            } catch { /* ignore */ }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendMessage(input)
  }

  return (
    <main className="h-screen flex flex-col ink-wash">
      <header className="shrink-0 bg-ink-50/90 backdrop-blur-sm border-b border-ink-100 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/form" className="text-ink-400 hover:text-ink-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="font-serif-cn text-lg text-ink-700">取名顾问</h1>
          {scoredNames.length > 0 && (
            <button
              onClick={() => {
                sessionStorage.setItem('namingPipelineResults', JSON.stringify({ names: scoredNames }))
                router.push('/results?mode=naming')
              }}
              className="text-sm text-ink-400 hover:text-ink-600 transition-colors"
            >
              查看结果
            </button>
          )}
          {!scoredNames.length && <div className="w-5" />}
        </div>
      </header>

      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          {/* Messages */}
          {messages.filter(m => m.content !== '').map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-sm px-4 py-3 ${message.role === 'user' ? 'bg-ink-900 text-ink-50' : 'bg-white border border-ink-100 text-ink-700'}`}>
                {message.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                ) : (
                  <div className="text-sm leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
                )}
              </div>
            </div>
          ))}

          {/* Pipeline progress */}
          {isLoading && pipelineStage >= 0 && (
            <div className="card-elegant p-6">
              <div className="space-y-3">
                {PIPELINE_STEPS.map((step, index) => {
                  const status = pipelineStepStatus[step.key]?.status
                  const summary = pipelineStepStatus[step.key]?.summary
                  return (
                    <div key={step.key} className={`flex items-center gap-3 p-2 rounded-sm transition-all ${
                      status === 'done' ? 'bg-jade-50 text-jade-700' :
                      index === pipelineStage ? 'bg-ink-100 text-ink-800' :
                      'text-ink-400'
                    }`}>
                      <span className="w-6 h-6 flex items-center justify-center">
                        {status === 'done' ? (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-jade-500">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        ) : index === pipelineStage ? (
                          <div className="w-4 h-4 border-2 border-ink-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-ink-300" />
                        )}
                      </span>
                      <span className="flex-1 text-sm">{step.label}</span>
                      {status === 'done' && summary && (
                        <span className="text-xs text-ink-400">{summary}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Streaming text during generating stage */}
              {generatingText && (
                <div className="mt-4 text-sm text-ink-600 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(generatingText) }}
                />
              )}
            </div>
          )}

          {/* Score cards */}
          {scoredNames.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-serif-cn text-lg text-ink-700">推荐名字</h3>
              {scoredNames.map((name) => (
                <NameScoreCard key={name.name} data={name} />
              ))}
            </div>
          )}

          {/* Loading dots (for chat, not pipeline) */}
          {isLoading && pipelineStage < 0 && messages[messages.length - 1]?.content === '' && (
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

      <div className="shrink-0 bg-ink-50/90 backdrop-blur-sm border-t border-ink-100">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 input-field"
              placeholder={scoredNames.length > 0 ? '继续对话微调...' : '输入您的想法...'}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-3 bg-ink-900 text-ink-50 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink-800 transition-colors"
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
