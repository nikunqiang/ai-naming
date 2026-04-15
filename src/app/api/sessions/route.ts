// src/app/api/sessions/route.ts
import { NextResponse } from 'next/server'
import { listSessions } from '@/lib/session'

export async function GET() {
  try {
    const sessions = listSessions()
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('List sessions error:', error)
    return NextResponse.json({ error: '获取会话列表失败' }, { status: 500 })
  }
}
