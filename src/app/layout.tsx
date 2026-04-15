import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '取名 | 中文取名顾问',
  description: '为宝宝取一个寓意美好的名字',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen ink-wash">
        {children}
      </body>
    </html>
  )
}
