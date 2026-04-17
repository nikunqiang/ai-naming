// src/components/DebugPanel.tsx
'use client'

import { useState } from 'react'
import type { AnalysisStep, StepEvent } from '@/types/analysis-events'
import { STEP_LABELS } from '@/types/analysis-events'

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

interface DebugPanelProps {
  steps: Record<string, StepState>
  totalTime?: number
}

export default function DebugPanel({ steps, totalTime }: DebugPanelProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  const stepOrder: AnalysisStep[] = ['chars', 'wuxing', 'benefit', 'sancai', 'phonetic', 'harmony', 'glyph', 'popularity', 'prompt', 'ai']

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100 font-mono text-xs overflow-hidden">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <span className="text-sm font-semibold">分析过程</span>
        {totalTime != null && (
          <span className="text-gray-400">总耗时 {(totalTime / 1000).toFixed(1)}s</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {stepOrder.map(stepKey => {
          const step = steps[stepKey]
          if (!step) return null
          const isExpanded = expandedStep === stepKey
          const label = STEP_LABELS[stepKey]

          return (
            <div key={stepKey} className="border-b border-gray-800">
              <button
                onClick={() => setExpandedStep(isExpanded ? null : stepKey)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-800 text-left"
              >
                <span className="w-4 text-center">
                  {step.status === 'done' ? '✓' : step.status === 'running' ? '⏳' : step.status === 'error' ? '✗' : '○'}
                </span>
                <span className={`flex-1 ${step.status === 'done' ? 'text-green-400' : step.status === 'error' ? 'text-red-400' : step.status === 'running' ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {label}
                </span>
                {step.duration != null && (
                  <span className="text-gray-500">{step.duration}ms</span>
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {step.summary && (
                    <div className="text-gray-300">{step.summary}</div>
                  )}
                  {step.error && (
                    <div className="text-red-400">{step.error}</div>
                  )}
                  {step.systemPrompt && (
                    <details className="text-gray-400">
                      <summary className="cursor-pointer text-gray-500">System Prompt</summary>
                      <pre className="mt-1 p-2 bg-gray-800 rounded overflow-x-auto whitespace-pre-wrap text-[10px] max-h-40 overflow-y-auto">{step.systemPrompt}</pre>
                    </details>
                  )}
                  {step.prompt && (
                    <details open>
                      <summary className="cursor-pointer text-gray-500">User Prompt</summary>
                      <pre className="mt-1 p-2 bg-gray-800 rounded overflow-x-auto whitespace-pre-wrap text-[10px] max-h-60 overflow-y-auto">{step.prompt}</pre>
                    </details>
                  )}
                  {step.chunks && (
                    <div>
                      <div className="text-gray-500 mb-1">AI 回复</div>
                      <pre className="p-2 bg-gray-800 rounded overflow-x-auto whitespace-pre-wrap text-[10px] max-h-60 overflow-y-auto">{step.chunks}</pre>
                    </div>
                  )}
                  {step.detail && !step.prompt && !step.chunks && (
                    <pre className="p-2 bg-gray-800 rounded overflow-x-auto whitespace-pre-wrap text-[10px] max-h-60 overflow-y-auto">{JSON.stringify(step.detail, null, 2)}</pre>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
