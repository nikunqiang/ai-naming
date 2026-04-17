// src/app/memory/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface NameRecord {
  id: number
  name: string
  surname: string
  given_name: string
  preference: string
  score: number | null
  tag_names: string | null
  created_at: string
}

interface Stats {
  total: number
  liked: number
  neutral: number
  disliked: number
}

export default function MemoryPage() {
  const [names, setNames] = useState<NameRecord[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, liked: 0, neutral: 0, disliked: 0 })
  const [filter, setFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [filter, search])

  async function loadData() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter) params.set('preference', filter)
    if (search) params.set('search', search)

    const [namesRes, statsRes] = await Promise.all([
      fetch(`/api/names?${params}`),
      fetch('/api/names/stats'),
    ])
    setNames(await namesRes.json())
    setStats(await statsRes.json())
    setLoading(false)
  }

  async function setPreference(id: number, preference: string) {
    await fetch(`/api/names/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preference }),
    })
    loadData()
  }

  async function handleDelete(id: number) {
    await fetch(`/api/names/${id}`, { method: 'DELETE' })
    loadData()
  }

  return (
    <main className="min-h-screen ink-wash">
      <header className="sticky top-0 z-50 bg-ink-50/90 backdrop-blur-sm border-b border-ink-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-ink-400 hover:text-ink-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="font-serif-cn text-lg text-ink-700">名字记忆</h1>
          <span className="text-sm text-ink-400">{stats.total} 个名字</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* 统计栏 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { key: '', label: '全部', count: stats.total },
            { key: 'liked', label: '喜欢', count: stats.liked },
            { key: 'neutral', label: '一般', count: stats.neutral },
            { key: 'disliked', label: '不喜欢', count: stats.disliked },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`card-elegant p-3 text-center ${filter === key ? 'border-ink-800' : ''}`}
            >
              <div className="text-2xl font-serif-cn text-ink-900">{count}</div>
              <div className="text-xs text-ink-400 mt-1">{label}</div>
            </button>
          ))}
        </div>

        {/* 搜索 */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索名字..."
            className="input-field w-full"
          />
        </div>

        {/* 名字列表 */}
        {loading ? (
          <div className="text-center text-ink-400 py-12">加载中...</div>
        ) : names.length === 0 ? (
          <div className="text-center text-ink-400 py-12">
            <p className="font-serif-cn text-xl mb-2">还没有记录</p>
            <p className="text-sm">分析过的名字会自动保存在这里</p>
          </div>
        ) : (
          <div className="space-y-3">
            {names.map(item => (
              <div key={item.id} className="card-elegant p-4">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/results?name=${encodeURIComponent(item.name)}&mode=analyze`}
                    className="font-serif-cn text-2xl text-ink-900 hover:text-vermilion-600 transition-colors"
                  >
                    {item.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    {(['liked', 'neutral', 'disliked'] as const).map(pref => (
                      <button
                        key={pref}
                        onClick={() => setPreference(item.id, pref)}
                        className={`px-2 py-0.5 rounded-sm text-xs ${item.preference === pref ? 'bg-ink-800 text-ink-50' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'}`}
                      >
                        {pref === 'liked' ? '喜欢' : pref === 'disliked' ? '不喜欢' : '一般'}
                      </button>
                    ))}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-ink-300 hover:text-red-500 text-xs ml-2"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-sm text-ink-500">
                  {item.score != null && <span>评分: {item.score}</span>}
                  <span>来源: {item.source === 'analyze' ? '分析' : '生成'}</span>
                  {item.tag_names && (
                    <div className="flex gap-1">
                      {item.tag_names.split(',').map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-ink-50 rounded-sm text-xs">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
