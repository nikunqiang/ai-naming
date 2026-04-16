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

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { name, birthTime, sessionId } = await req.json()
    console.log('Analyze API received name:', name)
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

    // ① 字符查询
    const chars = name.split('')
    const charInfos = chars.map((char: string) => getCharacterInfo(char) || { char, pinyin: '', wuxing: '-', strokes: 0 })
    console.log('Char infos:', charInfos.map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => `${c.char}:${c.pinyin}:${c.wuxing}:${c.strokes}`).join(', '))

    // ② 八字五行补益分析
    let wuxingBenefit = null
    let baZi = null
    if (birthTime) {
      const parsed = parseBirthTime(birthTime)
      if (parsed) {
        baZi = calculateBaZi(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute)
        if (baZi) {
          const nameWuxing = charInfos.slice(1).map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => c.wuxing).filter((w: string) => w !== '-')
          wuxingBenefit = analyzeWuxingBenefit(baZi, nameWuxing)
        }
      }
    }

    // ③ 三才五格增强分析
    const sancaiWugeEnhanced = analyzeSanCaiWuGeEnhanced(name)
    const sancaiWuge = analyzeSanCaiWuGe(name)

    // ④ 音律分析（增强版）
    const nameOnly = name.slice(1)
    const phonetic = analyzePhonetic(nameOnly)

    // ⑤ 谐音检查（增强版）
    const harmonyWarnings = checkHarmony(name)

    // ⑥ 字形分析
    const strokes = charInfos.map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => c.strokes)
    const glyph = analyzeGlyph(nameOnly, strokes.slice(1))

    // ⑦ 重名率分析
    const popularity = analyzeNamePopularity(nameOnly)

    // 保存用户消息
    const userMessage = `请分析名字"${name}"${birthTime ? `，出生时间：${birthTime}` : ''}`
    addMessage(currentSessionId, 'user', userMessage)

    // ⑧ 构建结构化提示词（包含所有量化评分）
    const analysisPrompt = buildAnalysisPrompt({
      name,
      charInfos,
      baZi,
      wuxingBenefit,
      sancaiWugeEnhanced,
      phonetic,
      harmonyWarnings,
      glyph,
      popularity,
    })

    // ⑨ 调用 AI 进行深度分析
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    })

    const message = await client.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: getAnalysisSystemPrompt(),
      messages: [{
        role: 'user',
        content: analysisPrompt,
      }],
    })

    const analysisText = message.content[0].type === 'text' ? message.content[0].text : ''

    // 保存AI回复
    addMessage(currentSessionId, 'assistant', analysisText)

    return new Response(JSON.stringify({
      sessionId: currentSessionId,
      name,
      pinyin: charInfos.map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => c.pinyin).filter(Boolean).join(' '),
      charInfos,
      baZi,
      wuxingBenefit,
      sancaiWuge,
      sancaiWugeEnhanced,
      phonetic,
      harmonyWarnings,
      glyph,
      popularity,
      analysis: analysisText,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Analyze API error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * 构建结构化分析提示词
 */
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

  // 八字信息
  if (baZi) {
    lines.push('')
    lines.push('## 八字信息')
    lines.push(`- 八字：${baZi.yearGan}${baZi.yearZhi} ${baZi.monthGan}${baZi.monthZhi} ${baZi.dayGan}${baZi.dayZhi} ${baZi.timeGan}${baZi.timeZhi}`)
    lines.push(`- 五行统计：金${baZi.wuxing.gold} 木${baZi.wuxing.wood} 水${baZi.wuxing.water} 火${baZi.wuxing.fire} 土${baZi.wuxing.earth}`)
    if (baZi.missing.length > 0) lines.push(`- 缺失五行：${baZi.missing.join('、')}`)
    lines.push(`- 主导五行：${baZi.dominant}`)
  }

  // 预计算评分数据
  lines.push('')
  lines.push('## 预计算评分数据')

  // 五行补益
  if (wuxingBenefit) {
    lines.push(`- 五行补益得分：${wuxingBenefit.score}/25（喜用神：${wuxingBenefit.xiYong.join('、')}，忌神：${wuxingBenefit.jiShen.join('、')}）`)
    lines.push(`- 补益说明：${wuxingBenefit.nameBenefit}`)
  } else {
    lines.push(`- 五行补益得分：未提供八字，仅从字面分析（上限15分）`)
  }

  // 三才五格
  if (sancaiWugeEnhanced) {
    lines.push(`- 三才五格得分：${sancaiWugeEnhanced.score}/20（三才${sancaiWugeEnhanced.sancaiLevel}：${sancaiWugeEnhanced.sancaiFortune}）`)
    lines.push(`  - 天格${sancaiWugeEnhanced.tianGe.num}(${sancaiWugeEnhanced.tianGe.level}) 人格${sancaiWugeEnhanced.renGe.num}(${sancaiWugeEnhanced.renGe.level}) 地格${sancaiWugeEnhanced.diGe.num}(${sancaiWugeEnhanced.diGe.level}) 外格${sancaiWugeEnhanced.waiGe.num}(${sancaiWugeEnhanced.waiGe.level}) 总格${sancaiWugeEnhanced.zongGe.num}(${sancaiWugeEnhanced.zongGe.level})`)
  }

  // 音律
  lines.push(`- 音律得分：${phonetic.score}/20（${phonetic.analysis}）`)
  lines.push(`  - 声调：${phonetic.toneNames.join(' → ')}，${phonetic.toneAnalysis}`)
  lines.push(`  - 韵母：${phonetic.rhymeAnalysis}`)
  lines.push(`  - 开闭口音：${phonetic.opennessAnalysis}`)

  // 谐音
  if (harmonyWarnings.length > 0) {
    lines.push(`- 谐音预警：${harmonyWarnings.join('、')}（音律得分已扣10分）`)
  }

  // 字形
  lines.push(`- 字形得分：${glyph.score}/10`)
  lines.push(`  - 笔画平衡：${glyph.strokeBalance}`)
  lines.push(`  - 书写便利：${glyph.writingEase}`)
  lines.push(`  - 视觉结构：${glyph.visualStructure}`)
  lines.push(`  - 生僻度：${glyph.rarity}`)

  // 重名率
  lines.push(`- 时代适用得分：${popularity.score}/5（重名率：${popularity.level}，出现${popularity.count}次）`)

  // 字义（待 LLM 评估）
  lines.push(`- 字义内涵得分：待你评估（满分20分）`)

  // 输出格式要求
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
