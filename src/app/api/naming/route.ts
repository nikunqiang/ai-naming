// src/app/api/naming/route.ts
import { Anthropic } from '@anthropic-ai/sdk'
import { loadModelConfig } from '@/lib/model-config'
import { getSystemPrompt } from '@/lib/llm'
import { getCharacterInfo } from '@/lib/character'
import { analyzeSanCaiWuGeEnhanced } from '@/lib/sancai-wuge'
import { analyzePhonetic, checkHarmony } from '@/lib/phonetic'
import { calculateBaZi, parseBirthTime, analyzeWuxingBenefit } from '@/lib/wuxing'
import { analyzeGlyph } from '@/lib/glyph'
import { analyzeNamePopularity } from '@/lib/popularity'
import { saveName, getDislikedChars, getDislikedNames } from '@/lib/db'
import { buildCandidateCharPool, buildGenericCharPool } from '@/lib/candidate-filter'
import { getRetriever } from '@/lib/rag'
import type { NamingStepEvent, NamingCompleteEvent, ScoredName, NamingRequest, CandidateCharPool } from '@/types/naming-events'

export const maxDuration = 120

/** SSE helper */
function sendEvent(controller: ReadableStreamDefaultController, event: NamingStepEvent | NamingCompleteEvent): void {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
}

/** Timer helper */
function timed<T>(fn: () => T): { result: T; duration: number } {
  const start = Date.now()
  const result = fn()
  return { result, duration: Date.now() - start }
}

export async function POST(req: Request) {
  const body: NamingRequest = await req.json()
  const config = loadModelConfig()

  if (!body.surname) {
    return new Response(JSON.stringify({ error: '请提供姓氏' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ===== Stage 1: filtering =====
        sendEvent(controller, { step: 'filtering', status: 'running' })

        let baZi: ReturnType<typeof calculateBaZi> = null
        let xiYong: string[] = []
        let jiShen: string[] = []
        let candidatePool: CandidateCharPool

        const { result: filterResult, duration: filterDuration } = timed(() => {
          const avoidCharsList = (body.avoidChars || '').split(/[,，、\s]/).filter(Boolean)

          if (body.birthTime) {
            const parsed = parseBirthTime(body.birthTime)
            if (parsed) {
              baZi = calculateBaZi(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute)
            }
          }

          if (baZi) {
            const benefit = analyzeWuxingBenefit(baZi, ['木']) // dummy wuxing, just to get xiYong/jiShen
            xiYong = benefit.xiYong
            jiShen = benefit.jiShen
            candidatePool = buildCandidateCharPool(xiYong, body.gender, avoidCharsList)
            candidatePool.jiShen = jiShen
          } else {
            candidatePool = buildGenericCharPool(body.gender, avoidCharsList)
          }

          return candidatePool
        })

        candidatePool = filterResult

        sendEvent(controller, {
          step: 'filtering', status: 'done', duration: filterDuration,
          summary: `候选字池：${candidatePool.primary.length}个喜用字 + ${candidatePool.secondary.length}个通用字${xiYong.length > 0 ? `，喜用神：${xiYong.join('、')}` : ''}`,
          detail: { poolSize: candidatePool.primary.length + candidatePool.secondary.length, xiYong, jiShen },
        })

        // ===== Stage 2: RAG =====
        sendEvent(controller, { step: 'rag', status: 'running' })

        let ragResults: Array<{ source: string; content: string; relevance: number }> = []

        const { duration: ragDuration } = await (async () => {
          const start = Date.now()
          try {
            const retriever = getRetriever()
            await retriever.initialize()

            const queryParts: string[] = []
            if (xiYong.length > 0) queryParts.push(xiYong.join(' '))
            if (body.expectations) queryParts.push(body.expectations)

            const modeKeywords: Record<string, string> = {
              '文学': '诗意 典雅 意境',
              '传统': '吉祥 端正 稳重',
              '现代': '清新 简洁 时尚',
              '混合': '美好 寓意 深远',
            }
            queryParts.push(modeKeywords[body.namingMode] || '美好 寓意')

            const query = queryParts.join(' ')
            ragResults = await retriever.hybridSearch(query, 12)
          } catch (err) {
            console.error('RAG error:', err)
          }
          return { duration: Date.now() - start }
        })()

        const ragContext = ragResults.length > 0
          ? ragResults.map((r, i) => `${i + 1}. 【${r.source}】${r.content}`).join('\n')
          : undefined

        sendEvent(controller, {
          step: 'rag', status: 'done', duration: ragDuration,
          summary: `检索到${ragResults.length}条相关诗句`,
          detail: { resultCount: ragResults.length, topSources: ragResults.slice(0, 3).map(r => r.source) },
        })

        // ===== Stage 3: generating =====
        sendEvent(controller, { step: 'generating', status: 'running' })

        const allCandidateChars = [...candidatePool.primary, ...candidatePool.secondary]
        const systemPrompt = getSystemPrompt({
          dislikedChars: getDislikedChars(),
          dislikedNames: getDislikedNames().map(n => n.name),
          candidateChars: allCandidateChars,
          ragContext,
          xiYong,
          jiShen,
          namingMode: body.namingMode,
        })

        const userParts: string[] = []
        userParts.push(`我想为姓${body.surname}的${body.gender === '未定' ? '宝宝' : body.gender}孩取名。`)
        if (body.motherSurname) userParts.push(`母亲姓${body.motherSurname}，可以考虑组合。`)
        if (body.expectations) userParts.push(`期望寓意：${body.expectations}。`)
        if (body.avoidChars) userParts.push(`避免用字：${body.avoidChars}。`)
        userParts.push(`取名模式：${body.namingMode}。`)
        if (body.nameLength && body.nameLength !== '不限') {
          userParts.push(`名字字数：${body.nameLength === 1 ? '单字名' : '双字名'}。`)
        }
        userParts.push(`请推荐5个好名字，必须使用【名字】格式。`)
        const userMessage = userParts.join('')

        const client = new Anthropic({
          apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
          baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        })

        let fullText = ''
        const genStart = Date.now()

        const llmStream = client.messages.stream({
          model: config.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })

        llmStream.on('text', (text: string) => {
          fullText += text
          sendEvent(controller, { step: 'generating', status: 'running', chunk: text })
        })

        await llmStream.finalMessage()
        const genDuration = Date.now() - genStart

        // Parse 【名字】 format
        const bracketRegex = /【([^\】]+)】/g
        const rawNames: string[] = []
        let match: RegExpExecArray | null
        while ((match = bracketRegex.exec(fullText)) !== null) {
          const name = match[1].trim()
          if (name.startsWith(body.surname) && name.length >= 2 && name.length <= 3) {
            rawNames.push(name)
          }
        }

        sendEvent(controller, {
          step: 'generating', status: 'done', duration: genDuration,
          summary: `生成${rawNames.length}个候选名：${rawNames.join('、')}`,
          detail: { rawNames, textLength: fullText.length },
        })

        // ===== Stage 4: scoring =====
        sendEvent(controller, { step: 'scoring', status: 'running' })

        const scoredNames: ScoredName[] = []
        const scoreStart = Date.now()

        for (const name of rawNames) {
          const givenName = name.slice(body.surname.length)
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
          const meaningScore = 15

          const scores = {
            wuxingBenefit: wuxingBenefitScore,
            sancaiWuge: sancai?.score ?? 10,
            phonetic: phonetic.score,
            meaning: meaningScore,
            glyph: glyph.score,
            popularity: popularity.score,
          }

          const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0)

          if (totalScore < 60) continue

          let classicSource: string | undefined
          for (const r of ragResults) {
            if (givenName.split('').some(c => r.content.includes(c))) {
              classicSource = `《${r.source}》"${r.content}"`
              break
            }
          }

          let meaningText: string | undefined
          const meaningRegex = new RegExp(`【${name}】[^]*?\\*\\*寓意\\*\\*[：:]\\s*(.+?)(?:\\n|\\*\\*)`, 'u')
          const meaningMatch = fullText.match(meaningRegex)
          if (meaningMatch) meaningText = meaningMatch[1].trim()

          let nameId: number | undefined
          try {
            nameId = saveName({
              name,
              surname: body.surname,
              givenName,
              source: 'generate',
              score: totalScore,
              scoresJson: JSON.stringify(scores),
              analysisSummary: meaningText?.substring(0, 100),
              birthTime: body.birthTime,
            })
          } catch (e) {
            console.error('Failed to save name:', e)
          }

          scoredNames.push({
            name,
            surname: body.surname,
            givenName,
            pinyin: charInfos.map(c => c.pinyin).filter(Boolean).join(' '),
            scores,
            totalScore,
            wuxingTags: charInfos.slice(1).map(c => c.wuxing).filter(w => w !== '-'),
            strokes: charInfos.map(c => c.strokes),
            classicSource,
            meaningText,
            harmonyWarnings: harmonyWarnings.length > 0 ? harmonyWarnings : undefined,
            nameId,
          })
        }

        const scoreDuration = Date.now() - scoreStart

        sendEvent(controller, {
          step: 'scoring', status: 'done', duration: scoreDuration,
          summary: `评分完成：${scoredNames.length}个合格名（过滤了${rawNames.length - scoredNames.length}个低分名）`,
          detail: { passed: scoredNames.length, filtered: rawNames.length - scoredNames.length },
        })

        // ===== Complete =====
        sendEvent(controller, {
          type: 'complete',
          data: {
            names: scoredNames,
            candidateChars: candidatePool,
          },
        })
      } catch (error) {
        console.error('Naming pipeline error:', error)
        sendEvent(controller, { step: 'scoring', status: 'done', summary: `错误：${String(error)}` })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
