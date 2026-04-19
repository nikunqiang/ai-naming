// src/app/api/score/route.ts
import { getCharacterInfo } from '@/lib/character'
import { analyzeSanCaiWuGeEnhanced } from '@/lib/sancai-wuge'
import { analyzePhonetic, checkHarmony } from '@/lib/phonetic'
import { calculateBaZi, parseBirthTime, analyzeWuxingBenefit } from '@/lib/wuxing'
import { analyzeGlyph } from '@/lib/glyph'
import { analyzeNamePopularity } from '@/lib/popularity'
import { saveName, getSavedNames } from '@/lib/db'
import type { ScoredName } from '@/types/naming-events'

export async function POST(req: Request) {
  const { names, surname, birthTime } = await req.json() as {
    names: string[]
    surname: string
    birthTime?: string
  }

  if (!names?.length || !surname) {
    return Response.json({ error: 'names and surname required' }, { status: 400 })
  }

  const savedNames = getSavedNames()
  let baZi: ReturnType<typeof calculateBaZi> = null
  if (birthTime) {
    const parsed = parseBirthTime(birthTime)
    if (parsed) {
      baZi = calculateBaZi(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute)
    }
  }

  const scored: ScoredName[] = []

  for (const name of names) {
    // Skip names already in memory
    if (savedNames.includes(name)) continue

    const givenName = name.slice(surname.length)
    const chars = name.split('')
    const charInfos = chars.map(c => getCharacterInfo(c) || { char: c, pinyin: '', wuxing: '-', strokes: 0 })

    const sancai = analyzeSanCaiWuGeEnhanced(name)
    const phonetic = analyzePhonetic(givenName)
    const strokes = charInfos.map(c => c.strokes)
    const glyph = analyzeGlyph(givenName, strokes.slice(1))
    const popularity = analyzeNamePopularity(givenName)

    let wuxingBenefitScore = 13
    if (baZi) {
      const nameWuxing = charInfos.slice(1).map(c => c.wuxing).filter(w => w !== '-')
      const benefit = analyzeWuxingBenefit(baZi, nameWuxing)
      wuxingBenefitScore = benefit.score
    }

    const harmonyWarnings = checkHarmony(name)

    const scores = {
      wuxingBenefit: wuxingBenefitScore,
      sancaiWuge: sancai?.score ?? 10,
      phonetic: phonetic.score,
      meaning: 15,
      glyph: glyph.score,
      popularity: popularity.score,
    }

    const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0)
    if (totalScore < 60) continue

    let nameId: number | undefined
    try {
      nameId = saveName({
        name,
        surname,
        givenName,
        source: 'chat',
        score: totalScore,
        scoresJson: JSON.stringify(scores),
        birthTime,
      })
    } catch (e) {
      console.error('Failed to save name:', e)
    }

    scored.push({
      name,
      surname,
      givenName,
      pinyin: charInfos.map(c => c.pinyin).filter(Boolean).join(' '),
      scores,
      totalScore,
      wuxingTags: charInfos.slice(1).map(c => c.wuxing).filter(w => w !== '-'),
      strokes: charInfos.map(c => c.strokes),
      harmonyWarnings: harmonyWarnings.length > 0 ? harmonyWarnings : undefined,
      nameId,
      preference: 'neutral',
    })
  }

  return Response.json({ names: scored })
}