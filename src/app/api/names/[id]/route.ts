// src/app/api/names/[id]/route.ts
import { updatePreference, addTag, removeTag, deleteName } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    const body = await req.json()

    if (body.preference) {
      updatePreference(id, body.preference)
    }
    if (body.addTag) {
      addTag(id, body.addTag)
    }
    if (body.removeTag) {
      removeTag(id, body.removeTag)
    }

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    deleteName(id)
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
