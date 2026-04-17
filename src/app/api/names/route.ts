// src/app/api/names/route.ts
import { listNames, saveName } from '@/lib/db'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const preference = url.searchParams.get('preference') || undefined
  const tag = url.searchParams.get('tag') || undefined
  const search = url.searchParams.get('search') || undefined
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  const names = listNames({ preference, tag, search, limit, offset })
  return Response.json(names)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = saveName({
      name: body.name,
      surname: body.surname,
      givenName: body.givenName,
      source: body.source || 'analyze',
      sessionId: body.sessionId,
      score: body.score,
      scoresJson: body.scoresJson ? JSON.stringify(body.scoresJson) : undefined,
      analysisSummary: body.analysisSummary,
      birthTime: body.birthTime,
    })
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
