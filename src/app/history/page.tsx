'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Session {
  sessionId: string
  createdAt: string
  updatedAt: string
  mode: 'naming' | 'analyze'
  messages: Message[]
  formData?: {
    surname?: string
    gender?: string
    expectations?: string
  }
  analyzedName?: string
}

// 简单的 Markdown 渲染
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-ink-800 mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-ink-800 mt-4 mb-2 text-base">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-semibold text-ink-800 mt-4 mb-2">$1</h2>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-ink-600">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-ink-600">$2</li>')
    .replace(/\n/g, '<br/>')
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      return minutes <= 1 ? '刚刚' : `${minutes}分钟前`
    }
    return `${hours}小时前`
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

export default function HistoryPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getSessionTitle = (session: Session): string => {
    if (session.mode === 'analyze') {
      // 从消息中提取分析的名字
      const firstUserMsg = session.messages.find(m => m.role === 'user')
      if (firstUserMsg) {
        const nameMatch = firstUserMsg.content.match(/[""]([^""]+)[""]/)
        if (nameMatch) return `分析：${nameMatch[1]}`
      }
      return '名字分析'
    } else {
      if (session.formData?.surname) {
        return `取名：${session.formData.surname}姓${session.formData.gender || '宝宝'}`
      }
      return '取名咨询'
    }
  }

  return (
    <main className="min-h-screen ink-wash">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-ink-50/90 backdrop-blur-sm border-b border-ink-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-ink-400 hover:text-ink-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="font-serif-cn text-lg text-ink-700">历史会话</h1>
          <div className="w-5" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="flex gap-1 justify-center">
              <span className="w-2 h-2 bg-ink-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-ink-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-ink-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-ink-400 mb-4">暂无历史会话</p>
            <Link href="/" className="text-vermilion-600 hover:text-vermilion-700">
              开始新的取名之旅
            </Link>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* 会话列表 */}
            <div className={` ${selectedSession ? 'w-1/3' : 'w-full'}`}>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    onClick={() => setSelectedSession(session)}
                    className={`card-elegant p-4 cursor-pointer transition-all ${
                      selectedSession?.sessionId === session.sessionId
                        ? 'ring-2 ring-ink-400'
                        : 'hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-ink-800 truncate">
                        {getSessionTitle(session)}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-sm ${
                        session.mode === 'analyze'
                          ? 'bg-jade-50 text-jade-700'
                          : 'bg-vermilion-50 text-vermilion-700'
                      }`}>
                        {session.mode === 'analyze' ? '测名' : '取名'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-400">
                      <span>{formatDate(session.updatedAt)}</span>
                      <span>{session.messages.length} 条消息</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 会话详情 */}
            {selectedSession && (
              <div className="w-2/3">
                <div className="card-elegant p-6">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-ink-100">
                    <h2 className="font-serif-cn text-lg text-ink-800">
                      {getSessionTitle(selectedSession)}
                    </h2>
                    <button
                      onClick={() => {
                        if (selectedSession.mode === 'analyze') {
                          router.push('/analyze')
                        } else {
                          router.push('/form')
                        }
                      }}
                      className="text-sm text-vermilion-600 hover:text-vermilion-700"
                    >
                      继续对话
                    </button>
                  </div>

                  {/* 消息列表 */}
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {selectedSession.messages.length === 0 ? (
                      <p className="text-ink-400 text-center py-8">暂无对话内容</p>
                    ) : (
                      selectedSession.messages.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-sm px-4 py-3 ${
                              msg.role === 'user'
                                ? 'bg-ink-900 text-ink-50'
                                : 'bg-ink-50 text-ink-700 border border-ink-100'
                            }`}
                          >
                            {msg.role === 'user' ? (
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                              <div
                                className="text-sm leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                              />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
