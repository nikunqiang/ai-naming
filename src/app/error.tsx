'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center ink-wash">
      <div className="text-center space-y-4">
        <h2 className="font-serif-cn text-xl text-ink-700">出了点问题</h2>
        <p className="text-sm text-ink-500">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-ink-900 text-ink-50 rounded-sm hover:bg-ink-800 transition-colors"
        >
          重试
        </button>
      </div>
    </div>
  )
}
