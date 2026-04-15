'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

// 简单的 Markdown 渲染
function renderMarkdown(text: string): string {
  return text
    // 粗体 **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 标题 ### text
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-ink-800 mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-ink-800 mt-4 mb-2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-semibold text-ink-800 mt-4 mb-2">$1</h2>')
    // 列表 - item 或 * item
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-ink-600">$1</li>')
    // 数字列表 1. item
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-ink-600">$2</li>')
    // 换行
    .replace(/\n/g, '<br/>')
}

export default function ChatPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<string>('')
  const initializedRef = useRef(false)

  useEffect(() => {
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'naming' }),
    })
      .then(res => res.json())
      .then(data => setSessionId(data.sessionId))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 加载表单数据并发送初始消息
  useEffect(() => {
    // 使用 ref 防止重复执行
    if (initializedRef.current) return
    initializedRef.current = true

    const formDataStr = sessionStorage.getItem('namingFormData')
    if (!formDataStr) return

    const formData: FormData = JSON.parse(formDataStr)
    if (!formData.surname || !formData.gender) return

    // 构建初始消息
    const parts: string[] = []
    parts.push(`我想为姓${formData.surname}的${formData.gender === '未定' ? '宝宝' : formData.gender}孩取名。`)

    if (formData.motherSurname) {
      parts.push(`母亲姓${formData.motherSurname}，可以考虑组合。`)
    }

    if (formData.expectations) {
      parts.push(`期望寓意：${formData.expectations}。`)
    }

    if (formData.avoidChars) {
      parts.push(`避免用字：${formData.avoidChars}。`)
    }

    parts.push(`取名模式：${formData.namingMode}。`)
    parts.push(`请帮我推荐几个好名字。`)

    const initialMessage = parts.join('')

    // 自动发送初始消息
    setTimeout(() => {
      sendMessage(initialMessage)
    }, 300)
  }, []) // 空依赖数组

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

    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
    }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

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
              setMessages(prev => {
                const updated = prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: contentRef.current }
                    : m
                )
                return updated
              })
            } catch {
              // ignore parse errors
            }
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
                className={`max-w-[85%] rounded-sm px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-ink-900 text-ink-50'
                    : 'bg-white border border-ink-100 text-ink-700'
                }`}
              >
                {message.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                ) : (
                  <div
                    className="text-sm leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                  />
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.content === '' && (
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
              onChange={(e) => setInput(e.target.value)}
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
