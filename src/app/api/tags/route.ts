// src/app/api/tags/route.ts
import { getAllTags, createTag } from '@/lib/db'

export async function GET() {
  return Response.json(getAllTags())
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = createTag(body.name, body.category || 'custom')
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
