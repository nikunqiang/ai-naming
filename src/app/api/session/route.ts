// src/app/api/session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSession, loadSession, listSessions } from '@/lib/session'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('id')

  if (sessionId) {
    const session = loadSession(sessionId)
    return NextResponse.json(session || { error: 'Session not found' }, {
      status: session ? 200 : 404
    })
  }

  const sessions = listSessions()
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const { mode } = await req.json()
  const session = createSession(mode || 'naming')
  return NextResponse.json(session)
}
