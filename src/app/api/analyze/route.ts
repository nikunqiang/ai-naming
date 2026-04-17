// src/app/api/analyze/route.ts
import { Anthropic } from '@anthropic-ai/sdk'
import { loadModelConfig } from '@/lib/model-config'
import { getCharacterInfo } from '@/lib/character'
import { analyzeSanCaiWuGe, analyzeSanCaiWuGeEnhanced } from '@/lib/sancai-wuge'
import { analyzePhonetic, checkHarmony } from '@/lib/phonetic'
import { calculateBaZi, parseBirthTime, analyzeWuxingBenefit } from '@/lib/wuxing'
import { analyzeGlyph } from '@/lib/glyph'
import { analyzeNamePopularity } from '@/lib/popularity'
import { createSession, addMessage } from '@/lib/session'
import { getAnalysisSystemPrompt } from '@/lib/llm'
import { saveName } from '@/lib/db'
import type { StepEvent, CompleteEvent } from '@/types/analysis-events'

export const maxDuration = 60

/** SSE 辅助：发送事件 */
function sendEvent(controller: ReadableStreamDefaultController, event: StepEvent | CompleteEvent): void {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
}

/** 计时辅助 */
function timed<T>(fn: () => T): { result: T; duration: number } {
  const start = Date.now()
  const result = fn()
  return { result, duration: Date.now() - start }
}

export async function POST(req: Request) {
  const { name, birthTime, sessionId } = await req.json()
  const config = loadModelConfig()

  if (!name || name.length < 2) {
    return new Response(JSON.stringify({ error: '请输入有效的姓名' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 创建或使用现有会话
  let currentSessionId = sessionId
  if (!currentSessionId) {
    const session = createSession('analyze')
    currentSessionId = session.sessionId
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ① 字符查询
        sendEvent(controller, { step: 'chars', status: 'running' })
        const { result: charInfos, duration: charsDuration } = timed(() => {
          const chars = name.split('')
          return chars.map((char: string) => getCharacterInfo(char) || { char, pinyin: '', wuxing: '-', strokes: 0 })
        })
        sendEvent(controller, {
          step: 'chars', status: 'done', duration: charsDuration,
          summary: charInfos.map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => `${c.char}:${c.wuxing}:${c.strokes}画`).join(', '),
          detail: { charInfos, source: 'char_info.json' },
        })

        // ② 八字五行
        let baZi = null
        sendEvent(controller, { step: 'wuxing', status: 'running' })
        const { result: wuxingResult, duration: wuxingDuration } = timed(() => {
          if (!birthTime) return null
          const parsed = parseBirthTime(birthTime)
          if (!parsed) return null
          return calculateBaZi(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute)
        })
        baZi = wuxingResult
        sendEvent(controller, {
          step: 'wuxing', status: 'done', duration: wuxingDuration,
          summary: baZi ? `${baZi.yearGan}${baZi.yearZhi} ${baZi.monthGan}${baZi.monthZhi} ${baZi.dayGan}${baZi.dayZhi} ${baZi.timeGan}${baZi.timeZhi}` : '未提供出生时间',
          detail: baZi ? { bazi: baZi, source: 'lunar-javascript' } : { skipped: true, reason: '未提供出生时间' },
        })

        // ③ 五行补益
        let wuxingBenefit = null
        sendEvent(controller, { step: 'benefit', status: 'running' })
        const { result: benefitResult, duration: benefitDuration } = timed(() => {
          if (!baZi) return null
          const nameWuxing = charInfos.slice(1).map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => c.wuxing).filter((w: string) => w !== '-')
          return analyzeWuxingBenefit(baZi, nameWuxing)
        })
        wuxingBenefit = benefitResult
        sendEvent(controller, {
          step: 'benefit', status: 'done', duration: benefitDuration,
          summary: wuxingBenefit ? `喜用神: ${wuxingBenefit.xiYong.join('、')}，忌神: ${wuxingBenefit.jiShen.join('、')}，得分: ${wuxingBenefit.score}/25` : '未提供八字',
          detail: wuxingBenefit ? { xiYong: wuxingBenefit.xiYong, jiShen: wuxingBenefit.jiShen, score: wuxingBenefit.score, nameBenefit: wuxingBenefit.nameBenefit } : { skipped: true },
        })

        // ④ 三才五格
        sendEvent(controller, { step: 'sancai', status: 'running' })
        const { result: sancaiResult, duration: sancaiDuration } = timed(() => ({
          enhanced: analyzeSanCaiWuGeEnhanced(name),
          basic: analyzeSanCaiWuGe(name),
        }))
        const { enhanced: sancaiWugeEnhanced, basic: sancaiWuge } = sancaiResult
        sendEvent(controller, {
          step: 'sancai', status: 'done', duration: sancaiDuration,
          summary: `三才${sancaiWugeEnhanced!.sancaiLevel}，得分: ${sancaiWugeEnhanced!.score}/20`,
          detail: { sancaiWugeEnhanced, sancaiWuge },
        })

        // ⑤ 音律分析
        const nameOnly = name.slice(1)
        sendEvent(controller, { step: 'phonetic', status: 'running' })
        const { result: phonetic, duration: phoneticDuration } = timed(() => analyzePhonetic(nameOnly))
        sendEvent(controller, {
          step: 'phonetic', status: 'done', duration: phoneticDuration,
          summary: `${phonetic.toneNames.join('→')}，得分: ${phonetic.score}/20`,
          detail: { pinyins: phonetic.pinyins, tones: phonetic.tones, toneNames: phonetic.toneNames, toneAnalysis: phonetic.toneAnalysis, rhymeAnalysis: phonetic.rhymeAnalysis, opennessAnalysis: phonetic.opennessAnalysis, score: phonetic.score },
        })

        // ⑥ 谐音检查
        sendEvent(controller, { step: 'harmony', status: 'running' })
        const { result: harmonyWarnings, duration: harmonyDuration } = timed(() => checkHarmony(name))
        sendEvent(controller, {
          step: 'harmony', status: 'done', duration: harmonyDuration,
          summary: harmonyWarnings.length > 0 ? `发现${harmonyWarnings.length}个谐音: ${harmonyWarnings.join('、')}` : '无谐音风险',
          detail: { warnings: harmonyWarnings, source: 'harmony_warnings.json' },
        })

        // ⑦ 字形分析
        const strokes = charInfos.map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => c.strokes)
        sendEvent(controller, { step: 'glyph', status: 'running' })
        const { result: glyph, duration: glyphDuration } = timed(() => analyzeGlyph(nameOnly, strokes.slice(1)))
        sendEvent(controller, {
          step: 'glyph', status: 'done', duration: glyphDuration,
          summary: `${glyph.strokeBalance}，${glyph.writingEase}，得分: ${glyph.score}/10`,
          detail: { glyph, charStructureSource: 'char_structure.json' },
        })

        // ⑧ 重名率
        sendEvent(controller, { step: 'popularity', status: 'running' })
        const { result: popularity, duration: popularityDuration } = timed(() => analyzeNamePopularity(nameOnly))
        sendEvent(controller, {
          step: 'popularity', status: 'done', duration: popularityDuration,
          summary: `重名率: ${popularity.level}（${popularity.count}次），得分: ${popularity.score}/5`,
          detail: { popularity, source: 'names_corpus_gender.txt' },
        })

        // ⑨ 构建提示词
        const userMessage = `请分析名字"${name}"${birthTime ? `，出生时间：${birthTime}` : ''}`
        addMessage(currentSessionId, 'user', userMessage)

        const analysisPrompt = buildAnalysisPrompt({
          name, charInfos, baZi, wuxingBenefit, sancaiWugeEnhanced, phonetic, harmonyWarnings, glyph, popularity,
        })
        const systemPrompt = getAnalysisSystemPrompt()

        sendEvent(controller, {
          step: 'prompt', status: 'done',
          summary: `提示词构建完成（${analysisPrompt.length}字）`,
          detail: { promptLength: analysisPrompt.length, systemPromptLength: systemPrompt.length },
          prompt: analysisPrompt,
          systemPrompt,
        })

        // ⑩ AI 流式分析
        sendEvent(controller, { step: 'ai', status: 'running' })
        const aiStart = Date.now()

        const client = new Anthropic({
          apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
          baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        })

        let analysisText = ''
        const aiStream = client.messages.stream({
          model: config.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: analysisPrompt }],
        })

        aiStream.on('text', (text: string) => {
          analysisText += text
          sendEvent(controller, { step: 'ai', status: 'running', chunk: text })
        })

        await aiStream.finalMessage()
        const aiDuration = Date.now() - aiStart

        sendEvent(controller, {
          step: 'ai', status: 'done', duration: aiDuration,
          summary: `AI分析完成（${analysisText.length}字，${(aiDuration / 1000).toFixed(1)}s）`,
          result: analysisText,
        })

        // 保存AI回复
        addMessage(currentSessionId, 'assistant', analysisText)

        // 自动保存到记忆
        let savedNameId: number | undefined
        try {
          const surname = name.charAt(0)
          const givenName = name.slice(1)
          const totalScore = (wuxingBenefit?.score ?? 0) + (sancaiWugeEnhanced?.score ?? 0) + (phonetic?.score ?? 0) + (glyph?.score ?? 0) + (popularity?.score ?? 0)
          savedNameId = saveName({
            name, surname, givenName,
            source: 'analyze',
            sessionId: currentSessionId,
            score: totalScore,
            scoresJson: JSON.stringify({
              wuxingBenefit: wuxingBenefit?.score,
              sancaiWuge: sancaiWugeEnhanced?.score,
              phonetic: phonetic?.score,
              glyph: glyph?.score,
              popularity: popularity?.score,
            }),
            analysisSummary: analysisText.substring(0, 100),
            birthTime,
          })
        } catch (e) {
          console.error('Failed to save name to memory:', e)
        }

        // 构建完整结果
        const fullResult: Record<string, unknown> = {
          sessionId: currentSessionId,
          name,
          nameId: savedNameId,
          pinyin: charInfos.map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => c.pinyin).filter(Boolean).join(' '),
          charInfos, baZi, wuxingBenefit, sancaiWuge, sancaiWugeEnhanced,
          phonetic, harmonyWarnings, glyph, popularity,
          analysis: analysisText,
        }

        // 发送完成事件
        fullResult.nameId = savedNameId
        sendEvent(controller, { type: 'complete', data: fullResult })
      } catch (error) {
        sendEvent(controller, { step: 'ai', status: 'error', error: String(error) })
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

/** 构建结构化分析提示词（保持与之前一致） */
function buildAnalysisPrompt(data: {
  name: string
  charInfos: Array<{ char: string; pinyin: string; wuxing: string; strokes: number }>
  baZi: any
  wuxingBenefit: any
  sancaiWugeEnhanced: any
  phonetic: any
  harmonyWarnings: string[]
  glyph: any
  popularity: any
}): string {
  const { name, charInfos, baZi, wuxingBenefit, sancaiWugeEnhanced, phonetic, harmonyWarnings, glyph, popularity } = data
  const lines: string[] = []
  lines.push(`请对名字"${name}"进行全面分析。`)
  lines.push('')
  lines.push('## 基本信息')
  lines.push(`- 姓名：${name}`)
  lines.push(`- 各字拼音：${charInfos.map(c => `${c.char}(${c.pinyin || '未知'})`).join(' ')}`)
  lines.push(`- 五行属性：${charInfos.slice(1).map(c => c.wuxing).join(' ')}`)
  lines.push(`- 笔画数：${charInfos.map(c => c.strokes).join('、')}`)
  if (baZi) {
    lines.push('')
    lines.push('## 八字信息')
    lines.push(`- 八字：${baZi.yearGan}${baZi.yearZhi} ${baZi.monthGan}${baZi.monthZhi} ${baZi.dayGan}${baZi.dayZhi} ${baZi.timeGan}${baZi.timeZhi}`)
    lines.push(`- 五行统计：金${baZi.wuxing.gold} 木${baZi.wuxing.wood} 水${baZi.wuxing.water} 火${baZi.wuxing.fire} 土${baZi.wuxing.earth}`)
    if (baZi.missing.length > 0) lines.push(`- 缺失五行：${baZi.missing.join('、')}`)
    lines.push(`- 主导五行：${baZi.dominant}`)
  }
  lines.push('')
  lines.push('## 预计算评分数据')
  if (wuxingBenefit) {
    lines.push(`- 五行补益得分：${wuxingBenefit.score}/25（喜用神：${wuxingBenefit.xiYong.join('、')}，忌神：${wuxingBenefit.jiShen.join('、')}）`)
    lines.push(`- 补益说明：${wuxingBenefit.nameBenefit}`)
  } else {
    lines.push(`- 五行补益得分：未提供八字，仅从字面分析（上限15分）`)
  }
  if (sancaiWugeEnhanced) {
    lines.push(`- 三才五格得分：${sancaiWugeEnhanced.score}/20（三才${sancaiWugeEnhanced.sancaiLevel}：${sancaiWugeEnhanced.sancaiFortune}）`)
    lines.push(`  - 天格${sancaiWugeEnhanced.tianGe.num}(${sancaiWugeEnhanced.tianGe.level}) 人格${sancaiWugeEnhanced.renGe.num}(${sancaiWugeEnhanced.renGe.level}) 地格${sancaiWugeEnhanced.diGe.num}(${sancaiWugeEnhanced.diGe.level}) 外格${sancaiWugeEnhanced.waiGe.num}(${sancaiWugeEnhanced.waiGe.level}) 总格${sancaiWugeEnhanced.zongGe.num}(${sancaiWugeEnhanced.zongGe.level})`)
  }
  lines.push(`- 音律得分：${phonetic.score}/20（${phonetic.analysis}）`)
  lines.push(`  - 声调：${phonetic.toneNames.join(' → ')}，${phonetic.toneAnalysis}`)
  lines.push(`  - 韵母：${phonetic.rhymeAnalysis}`)
  lines.push(`  - 开闭口音：${phonetic.opennessAnalysis}`)
  if (harmonyWarnings.length > 0) {
    lines.push(`- 谐音预警：${harmonyWarnings.join('、')}（音律得分已扣10分）`)
  }
  lines.push(`- 字形得分：${glyph.score}/10`)
  lines.push(`  - 笔画平衡：${glyph.strokeBalance}`)
  lines.push(`  - 书写便利：${glyph.writingEase}`)
  lines.push(`  - 视觉结构：${glyph.visualStructure}`)
  lines.push(`  - 生僻度：${glyph.rarity}`)
  lines.push(`- 时代适用得分：${popularity.score}/5（重名率：${popularity.level}，出现${popularity.count}次）`)
  lines.push(`- 字义内涵得分：待你评估（满分20分）`)
  lines.push('')
  lines.push('## 输出格式要求')
  lines.push('')
  lines.push('### 综合评分：XX/100')
  lines.push('')
  lines.push('### 各维度评分')
  lines.push('| 维度 | 得分 | 说明 |')
  lines.push('|------|------|------|')
  lines.push('| 五行配置 | XX/25 | ... |')
  lines.push('| 三才五格 | XX/20 | ... |')
  lines.push('| 音律听感 | XX/20 | ... |')
  lines.push('| 字义内涵 | XX/20 | ... |')
  lines.push('| 字形结构 | XX/10 | ... |')
  lines.push('| 时代适用 | XX/5 | ... |')
  lines.push('')
  lines.push('### 详细分析')
  lines.push('[各维度的专业解读，引用具体数据]')
  lines.push('')
  lines.push('### 专家点评')
  lines.push('[核心优缺点总结，犀利但不刻薄]')
  lines.push('')
  lines.push('### 改进建议')
  lines.push('[如总分<70，给出具体替代字建议]')
  return lines.join('\n')
}
