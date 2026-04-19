// src/lib/llm.ts
import { loadModelConfig } from './model-config'

// 动态导入模型提供商
async function getModelClient(provider: string, baseUrl?: string) {
  switch (provider) {
    case 'anthropic':
      const { anthropic } = await import('@ai-sdk/anthropic')
      return anthropic

    case 'custom-anthropic':
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      return createAnthropic({
        apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
        baseURL: baseUrl || process.env.ANTHROPIC_BASE_URL,
      })

    case 'openai':
      const { openai } = await import('@ai-sdk/openai')
      return openai

    case 'google':
      const { google } = await import('@ai-sdk/google')
      return google

    case 'deepseek':
      const { createOpenAI } = await import('@ai-sdk/openai')
      return createOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1',
      })

    case 'ollama':
      const { ollama } = await import('ollama-ai-provider')
      return ollama

    default:
      // 默认使用 anthropic
      const { anthropic: defaultClient } = await import('@ai-sdk/anthropic')
      return defaultClient
  }
}

/**
 * 获取当前配置的模型实例
 */
export async function getModel() {
  const config = loadModelConfig()
  const providerConfig = config.providers[config.provider]
  const baseUrl = providerConfig && 'baseUrl' in providerConfig ? providerConfig.baseUrl : undefined
  const client = await getModelClient(config.provider, baseUrl as string | undefined)
  return client(config.model)
}

/**
 * 获取模型实例（同步版本，用于已知提供商的情况）
 */
export function getModelSync() {
  const config = loadModelConfig()
  // 这里返回一个可以延迟调用的函数
  return async () => {
    const providerConfig = config.providers[config.provider]
    const baseUrl = providerConfig && 'baseUrl' in providerConfig ? providerConfig.baseUrl : undefined
    const client = await getModelClient(config.provider, baseUrl as string | undefined)
    return client(config.model)
  }
}

/** getSystemPrompt 选项 */
export interface SystemPromptOptions {
  dislikedChars?: string[]
  dislikedNames?: string[]
  candidateChars?: string[]
  ragContext?: string
  xiYong?: string[]
  jiShen?: string[]
  namingMode?: string
}

/**
 * 获取系统提示词（取名模式）
 */
export function getSystemPrompt(
  optionsOrChars?: string[] | SystemPromptOptions,
  dislikedNames?: string[]
): string {
  // Backward compat: if first arg is array, treat as old-style (dislikedChars, dislikedNames)
  let options: SystemPromptOptions
  if (Array.isArray(optionsOrChars)) {
    options = { dislikedChars: optionsOrChars, dislikedNames }
  } else {
    options = optionsOrChars || {}
  }

  const {
    dislikedChars,
    dislikedNames: dn,
    candidateChars,
    ragContext,
    xiYong,
    jiShen,
    namingMode,
  } = options

  let prompt = `你是一位专业、客观的中文取名顾问，精通传统文化和现代审美。

你的能力：
1. 为新生儿取名：根据用户需求生成合适的名字
2. 分析已有名字：客观解析名字的真实优劣

**重要原则：**
- 必须客观公正，好就是好，坏就是坏，不要回避问题
- 不要一味说好话，要指出名字的真实优缺点
- 推荐名字时要实事求是，不要过度美化
- 如果名字有问题，直接指出，不要拐弯抹角
- 尊重传统但不迷信，注重文化内涵
- 名字要好听、好写、好记
- 避免生僻字、不雅谐音

**评分锚定规则：**
- 90+ 分：各维度都优秀，极少数名字能达到
- 80-89 分：多数维度优秀，个别有瑕疵
- 70-79 分：普通好名字，有一定优点
- 60-69 分：有较明显问题
- <60 分：有严重问题

**禁止"和稀泥"：**
- 差就是差，不用"尚可""还行""基本可以"等模糊词
- 五行/三才五格的解读必须引用具体数据，不能泛泛而谈

取名策略：
- 文学模式：从诗经楚辞唐诗宋词中寻找灵感，注重意境和韵律
- 传统模式：考虑五行八字、三才五格，以命理为核心
- 现代模式：注重实用性，避免生僻字
- 混合模式：综合考虑以上因素

**重要：名字展示格式要求**
推荐名字时，必须使用以下格式：

## 推荐名字

### 1. 【名字】(拼音)
- **出处**：引用的诗句或典故（如无则写"无特定出处"）
- **寓意**：名字的含义解释
- **五行**：字的五行属性
- **音律**：声调搭配分析
- **注意**：潜在的问题或不足（如谐音、生僻程度等，没有则写"无明显问题"）

请严格按照此格式展示每个推荐的名字，确保拼音准确，并客观指出每个名字的优缺点。`

  // 候选字池约束
  if (candidateChars && candidateChars.length > 0) {
    prompt += `\n\n**候选字约束：**\n请从以下候选字中组合名字：${candidateChars.join('、')}。\n这些字已根据五行喜用神筛选，优先使用喜用神匹配的字。不要使用候选字池以外的字。`
  }

  // RAG诗词典故
  if (ragContext) {
    prompt += `\n\n**可参考的诗词典故：**\n${ragContext}`
  }

  // 喜用神/忌神
  if (xiYong && xiYong.length > 0) {
    prompt += `\n\n**命理约束：**\n- 喜用神：${xiYong.join('、')}（名字五行宜包含喜用神）\n- 忌神：${jiShen?.join('、') || '无'}（名字五行宜避免忌神）`
  }

  // 取名模式强化
  if (namingMode) {
    const modeGuidance: Record<string, string> = {
      '传统': '请重点考虑五行八字和三才五格，确保命理配置优良。',
      '文学': '请重点从诗词典故中取意，注重意境美和音律美。',
      '现代': '请注重实用性，选择易读易写、避免生僻的字，兼顾现代审美。',
      '混合': '请综合考虑命理、文化、实用性，平衡各维度。',
    }
    if (modeGuidance[namingMode]) {
      prompt += `\n\n**模式强调：**${modeGuidance[namingMode]}`
    }
  }

  // 排除规则
  if (dislikedChars && dislikedChars.length > 0) {
    prompt += `\n\n**用户偏好排除规则：**\n- 以下字已被用户标记为不喜欢，请不要在推荐名字中使用：${dislikedChars.join('、')}`
  }
  const effectiveDislikedNames = dn || dislikedNames
  if (effectiveDislikedNames && effectiveDislikedNames.length > 0) {
    prompt += `\n- 以下完整名字已被标记为不喜欢，请不要推荐：${effectiveDislikedNames.join('、')}`
  }

  return prompt
}

/**
 * 获取分析模式的系统提示词
 */
export function getAnalysisSystemPrompt(): string {
  return `你是一位拥有20年经验的资深姓名学专家，精通汉字字源、五行学说、三才五格、音律美学以及现代命名趋势。

你的原则：
1. 专业、客观、实事求是
2. 好的地方要肯定，不好的地方要明确指出
3. 不为了讨好用户而只说好话
4. 用现代语言解释，不要故弄玄虚
5. 评分要真实反映名字的质量，不要虚高

**评分锚定规则：**
- 90+ 分：各维度都优秀，极少数名字能达到
- 80-89 分：多数维度优秀，个别有瑕疵
- 70-79 分：普通好名字，有一定优点
- 60-69 分：有较明显问题
- <60 分：有严重问题

**禁止"和稀泥"：**
- 差就是差，不用"尚可""还行""基本可以"等模糊词
- 五行/三才五格的解读必须引用具体数据，不能泛泛而谈
- 如果某维度得分低，必须明确指出问题所在

**你的角色：**
你收到的数据中已包含各维度的量化评分。你的任务是：
1. 用专业语言解释每个维度得分的理由
2. 可以在量化评分基础上微调 ±2 分，但必须说明理由
3. 综合评分 = 各维度评分之和 + 你的微调
4. 给出专家点评和改进建议

你的风格是犀利但不刻薄，专业但不晦涩。用户需要的是真实的分析，帮助他们理解名字的真实价值。`
}
