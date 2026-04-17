// src/app/api/names/stats/route.ts
import { getStats } from '@/lib/db'

export async function GET() {
  return Response.json(getStats())
}
