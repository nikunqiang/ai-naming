'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* 装饰性水墨元素 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-20 -left-20 w-96 h-96 rounded-full opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle, #171717 0%, transparent 70%)',
            animation: 'float 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.02]"
          style={{
            background: 'radial-gradient(circle, #171717 0%, transparent 60%)',
            animation: 'float 10s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* 主内容 */}
      <div className={`relative z-10 text-center max-w-lg transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* 标题 */}
        <h1 className="font-serif-cn text-5xl md:text-6xl font-semibold text-ink-900 mb-3 tracking-tight">
          取名
        </h1>

        {/* 副标题 */}
        <p className="font-sans-cn text-ink-500 text-lg mb-12 font-light">
          为宝宝取一个寓意美好的名字
        </p>

        {/* 选择卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Link
            href="/form"
            className="group card-elegant p-8 flex flex-col items-center justify-center
                       hover:border-vermilion-500/30"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="w-12 h-12 mb-4 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-8 h-8 text-ink-600 group-hover:text-vermilion-500 transition-colors"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="font-serif-cn text-xl text-ink-800 group-hover:text-ink-900 transition-colors">
              取名
            </span>
            <span className="text-sm text-ink-400 mt-1">
              为宝宝取名
            </span>
          </Link>

          <Link
            href="/analyze"
            className="group card-elegant p-8 flex flex-col items-center justify-center
                       hover:border-jade-600/30"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="w-12 h-12 mb-4 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-8 h-8 text-ink-600 group-hover:text-jade-500 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75M12 3v2.25m4.5 13.5h3M3 18.75h3m3-3h3m3-3h3m-9 8.25h6a2.25 2.25 0 002.25-2.25V9a2.25 2.25 0 00-2.25-2.25H9A2.25 2.25 0 006.75 9v9.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <span className="font-serif-cn text-xl text-ink-800 group-hover:text-ink-900 transition-colors">
              测名
            </span>
            <span className="text-sm text-ink-400 mt-1">
              分析已有名字
            </span>
          </Link>

          <Link
            href="/memory"
            className="group card-elegant p-8 flex flex-col items-center justify-center
                       hover:border-ink-600/30"
            style={{ animationDelay: '0.3s' }}
          >
            <div className="w-12 h-12 mb-4 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-8 h-8 text-ink-600 group-hover:text-ink-800 transition-colors"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.778-.715-1.652-2.377-2.778-4.313-2.778C5.1 3.75 3 5.765 3 8.25c0 7.79 9.563 13.06 12 14.25 2.437-1.19 12-6.46 12-14.25z" />
              </svg>
            </div>
            <span className="font-serif-cn text-xl text-ink-800 group-hover:text-ink-900 transition-colors">
              记忆
            </span>
            <span className="text-sm text-ink-400 mt-1">
              名字记录与偏好
            </span>
          </Link>
        </div>

        {/* 历史会话入口 */}
        <Link
          href="/history"
          className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-ink-600 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="underline underline-offset-4 decoration-ink-200 hover:decoration-ink-400">
            查看历史会话
          </span>
        </Link>
      </div>

      {/* 底部装饰 */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 transition-all duration-700 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-xs text-ink-300 font-light">
          取材诗经楚辞 · 兼顾五行数理
        </p>
      </div>
    </main>
  )
}
