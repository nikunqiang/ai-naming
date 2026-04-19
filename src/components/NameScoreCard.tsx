// src/components/NameScoreCard.tsx
'use client'

import { useState } from 'react'
import type { ScoredName } from '@/types/naming-events'

interface NameScoreCardProps {
  data: ScoredName
  onSelect?: (name: string) => void
  selected?: boolean
}

const SCORE_DIMENSIONS = [
  { key: 'wuxingBenefit' as const, label: '五行补益', max: 25 },
  { key: 'sancaiWuge' as const, label: '三才五格', max: 20 },
  { key: 'phonetic' as const, label: '音律听感', max: 20 },
  { key: 'meaning' as const, label: '字义内涵', max: 20 },
  { key: 'glyph' as const, label: '字形结构', max: 10 },
  { key: 'popularity' as const, label: '时代适用', max: 5 },
]

function scoreBarColor(score: number, max: number): string {
  const pct = (score / max) * 100
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function totalScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-600'
}

const WUXING_COLORS: Record<string, string> = {
  '金': 'bg-ink-100 text-ink-700',
  '木': 'bg-emerald-50 text-emerald-700',
  '水': 'bg-blue-50 text-blue-700',
  '火': 'bg-red-50 text-red-700',
  '土': 'bg-amber-50 text-amber-700',
}

export default function NameScoreCard({ data, onSelect, selected }: NameScoreCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [pref, setPref] = useState<'liked' | 'neutral' | 'disliked' | null>(null)

  const handlePref = (p: 'liked' | 'neutral' | 'disliked') => {
    setPref(p)
    if (data.nameId) {
      fetch(`/api/names/${data.nameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference: p }),
      }).catch(() => {})
    }
  }

  return (
    <div className="card-elegant p-6">
      {/* Header: name + pinyin + select */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-serif-cn text-3xl text-ink-900 tracking-wider">
            {data.name}
          </h3>
          <p className="text-ink-400 text-sm mt-1">{data.pinyin}</p>
        </div>
        {onSelect && (
          <button
            onClick={() => onSelect(data.name)}
            className={`p-2 rounded-sm border transition-all
              ${selected ? 'border-vermilion-500 bg-vermilion-50 text-vermilion-500' : 'border-ink-200 text-ink-300 hover:border-ink-300'}`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M11 17l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z" />
            </svg>
          </button>
        )}
      </div>

      {/* Wuxing tags + strokes */}
      <div className="flex gap-4 text-sm mb-4">
        <div className="flex items-center gap-2">
          <span className="text-ink-400">五行</span>
          <div className="flex gap-1">
            {data.wuxingTags.map((w, i) => (
              <span key={i} className={`px-2 py-0.5 rounded-sm text-xs ${WUXING_COLORS[w] || 'bg-ink-50 text-ink-600'}`}>
                {w}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-400">笔画</span>
          <span className="text-ink-600">{data.strokes.join('-')}</span>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-2 mb-4">
        {SCORE_DIMENSIONS.map(({ key, label, max }) => {
          const score = data.scores[key]
          const pct = Math.round((score / max) * 100)
          return (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className="w-16 text-ink-500 shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-ink-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${scoreBarColor(score, max)} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-10 text-right text-ink-600 shrink-0">{score}/{max}</span>
            </div>
          )
        })}
      </div>

      {/* Total score */}
      <div className={`text-lg font-semibold mb-3 ${totalScoreColor(data.totalScore)}`}>
        总分 {data.totalScore}/100
      </div>

      {/* Harmony warnings */}
      {data.harmonyWarnings && data.harmonyWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 mb-3 text-sm text-amber-700">
          谐音提示：{data.harmonyWarnings.join('、')}
        </div>
      )}

      {/* Expandable: source + meaning */}
      {(data.classicSource || data.meaningText) && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-ink-400 hover:text-ink-600 transition-colors"
          >
            {expanded ? '收起详情 ▲' : '展开详情 ▼'}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2 text-sm">
              {data.classicSource && (
                <p className="text-vermilion-600 italic">「{data.classicSource}」</p>
              )}
              {data.meaningText && (
                <p className="text-ink-600">{data.meaningText}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preference buttons */}
      {data.nameId && (
        <div className="flex gap-2 mt-4">
          {(['liked', 'neutral', 'disliked'] as const).map(p => (
            <button
              key={p}
              onClick={() => handlePref(p)}
              className={`px-3 py-1 rounded-sm text-sm transition-colors
                ${pref === p
                  ? (p === 'liked' ? 'bg-jade-100 text-jade-700' : p === 'disliked' ? 'bg-red-100 text-red-700' : 'bg-ink-100 text-ink-700')
                  : (p === 'liked' ? 'bg-jade-50 text-jade-600 hover:bg-jade-100' : p === 'disliked' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-ink-50 text-ink-500 hover:bg-ink-100')
                }`}
            >
              {p === 'liked' ? '喜欢' : p === 'disliked' ? '不喜欢' : '一般'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
