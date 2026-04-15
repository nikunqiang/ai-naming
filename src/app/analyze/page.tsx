'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AnalyzePage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [birthTime, setBirthTime] = useState('')

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return
    // 跳转到结果页，带上参数
    const params = new URLSearchParams({
      name: fullName,
      mode: 'analyze',
      ...(birthTime && { birthTime }),
    })
    router.push(`/results?${params.toString()}`)
  }

  return (
    <main className="min-h-screen ink-wash">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-ink-50/80 backdrop-blur-sm border-b border-ink-100">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-ink-400 hover:text-ink-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="font-serif-cn text-lg text-ink-700">测名</h1>
          <div className="w-5" />
        </div>
      </header>

      {/* 表单内容 */}
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="font-serif-cn text-2xl text-ink-800 mb-2">分析已有名字</h2>
          <p className="text-ink-400 text-sm">全方位解析名字的寓意、五行、音律</p>
        </div>

        <form onSubmit={handleAnalyze} className="space-y-6">
          <div>
            <label className="block text-sm text-ink-600 mb-2">
              姓名 <span className="text-vermilion-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field text-center font-serif-cn text-xl tracking-widest"
              placeholder="请输入姓名"
              maxLength={4}
            />
            <p className="text-xs text-ink-300 mt-2 text-center">支持 2-4 个字的姓名</p>
          </div>

          <div>
            <label className="block text-sm text-ink-600 mb-2">
              出生时间 <span className="text-ink-300 text-xs ml-1">(可选，用于八字匹配)</span>
            </label>
            <input
              type="datetime-local"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={!fullName.trim()}
              className="w-full btn-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              开始分析
            </button>
          </div>
        </form>

        {/* 分析项预览 */}
        <div className="mt-12 pt-8 border-t border-ink-100">
          <h3 className="text-sm text-ink-500 mb-4 text-center">分析内容</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '字', label: '字义解析' },
              { icon: '五', label: '五行分析' },
              { icon: '数', label: '三才五格' },
              { icon: '音', label: '音律分析' },
              { icon: '诗', label: '诗词典故' },
              { icon: '寓', label: '寓意解读' },
              { icon: '谐', label: '谐音检查' },
              { icon: '形', label: '字形分析' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 px-3 py-2 bg-white/50 rounded-sm"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-ink-100 text-ink-500 text-xs rounded-sm">
                  {item.icon}
                </span>
                <span className="text-sm text-ink-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
