// src/app/api/analyze/route.ts
import { Anthropic } from '@anthropic-ai/sdk'
import { loadModelConfig } from '@/lib/model-config'
import { getCharacterInfo } from '@/lib/character'
import { analyzeSanCaiWuGe } from '@/lib/sancai-wuge'
import { analyzePhonetic, checkHarmony } from '@/lib/phonetic'
import { createSession, addMessage } from '@/lib/session'

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

    // 获取每个字的信息
    const chars = name.split('')
    const charInfos = chars.map(char => getCharacterInfo(char) || { char, pinyin: '', wuxing: '-', strokes: 0 })
    console.log('Char infos:', charInfos.map(c => `${c.char}:${c.pinyin}:${c.wuxing}:${c.strokes}`).join(', '))

    // 三才五格分析
    const sancaiWuge = analyzeSanCaiWuGe(name)

    // 音律分析
    const nameOnly = name.slice(1)
    const phonetic = analyzePhonetic(nameOnly)

    // 谐音检查
    const harmonyWarnings = checkHarmony(name)

    // 保存用户消息
    const userMessage = `请分析名字"${name}"${birthTime ? `，出生时间：${birthTime}` : ''}`
    addMessage(currentSessionId, 'user', userMessage)

    // 调用 AI 进行深度分析
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    })

    const analysisPrompt = `你是一位拥有20年经验的资深姓名学专家，精通汉字字源、五行学说、音律美学以及现代命名趋势。

你的风格：专业、客观、实事求是。你不为了讨好用户而只说好话，你认为每个名字都有其优点和局限性。

现在请对名字"${name}"进行全面分析。

**基本信息：**
- 姓名：${name}
- 各字拼音：${charInfos.map(c => `${c.char}(${c.pinyin || '未知'})`).join(' ')}
- 五行属性：${charInfos.slice(1).map(c => c.wuxing).join(' ')}
- 笔画数：${charInfos.map(c => c.strokes).join('、')}

${sancaiWuge ? `**三才五格：**
- 天格：${sancaiWuge.wuge.tianGe} (${sancaiWuge.sancai.tianCai})
- 人格：${sancaiWuge.wuge.renGe} (${sancaiWuge.sancai.renCai})
- 地格：${sancaiWuge.wuge.diGe} (${sancaiWuge.sancai.diCai})
- 外格：${sancaiWuge.wuge.waiGe}
- 总格：${sancaiWuge.wuge.zongGe}
- 三才配置：${sancaiWuge.sancai.fortune}` : ''}

**音律数据：**
- 声调：${phonetic.toneNames.join(' → ')}
- 初步评价：${phonetic.analysis}

${harmonyWarnings.length > 0 ? `**谐音预警：** ${harmonyWarnings.join('、')}` : ''}

请按以下格式输出分析结果：

## 综合评分：XX/100

## 维度分析

### 音律与听感（满分20分）
[分析声调搭配是否朗朗上口，是否存在拗口、声调平淡、不良谐音（包括方言谐音）。好的要肯定，有问题的直接指出]

### 字义与内涵（满分25分）
[分析每个字的含义，寓意是否吉祥，是否过于俗气或生僻，有无负面联想]

### 五行配置（满分25分）
[分析五行是否平衡，有无缺失或冲突。如无出生时间，说明"未提供八字，仅从字面分析五行配置"]

### 字形结构（满分15分）
[分析字形是否平衡美观，笔画是否适中，书写是否方便]

### 时代感（满分15分）
[分析名字是否符合当下审美，还是显得过时]

## 专家点评
[这是核心部分。用现代语言直接指出这个名字的真实优缺点。好的地方要肯定，不足的地方要明确指出。例如：如果名字俗气，直接说"这个名字重名率较高，缺乏个性"；如果五行有问题，直接说"五行缺金，对决断力无益"。不要绕弯子，不要无脑夸赞]

## 改进建议
[如果分数低于70分，给出具体的改进方向或替代字建议]`

    const message = await client.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: `你是一位拥有20年经验的资深姓名学专家。

你的原则：
1. 专业、客观、实事求是
2. 好的地方要肯定，不好的地方要明确指出
3. 不为了讨好用户而只说好话
4. 用现代语言解释，不要故弄玄虚
5. 评分要真实反映名字的质量，不要虚高

你的风格是犀利但不刻薄，专业但不晦涩。用户需要的是真实的分析，帮助他们理解名字的真实价值。`,
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
      pinyin: charInfos.map(c => c.pinyin).filter(Boolean).join(' '),
      charInfos,
      sancaiWuge,
      phonetic: {
        tones: phonetic.tones,
        toneNames: phonetic.toneNames,
        analysis: phonetic.analysis,
      },
      harmonyWarnings,
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
