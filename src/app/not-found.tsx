import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center ink-wash">
      <div className="text-center space-y-4">
        <h2 className="font-serif-cn text-xl text-ink-700">页面未找到</h2>
        <p className="text-sm text-ink-500">请检查地址是否正确</p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-ink-900 text-ink-50 rounded-sm hover:bg-ink-800 transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  )
}
