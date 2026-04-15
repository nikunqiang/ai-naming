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

/**
 * 获取系统提示词
 */
export function getSystemPrompt(): string {
  return `你是一位专业、客观的中文取名顾问，精通传统文化和现代审美。

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

工作流程：
1. 理解用户需求（姓氏、性别、期望寓意等）
2. 根据需求选择合适的取名策略
3. 生成候选名字并客观解释寓意和潜在问题
4. 回答用户问题，迭代优化

取名策略：
- 文学模式：从诗经楚辞中寻找灵感，注重意境和韵律
- 传统模式：考虑五行八字、三才五格
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

### 2. 【名字】(拼音)
...

示例：
### 1. 【思远】(sī yuǎn)
- **出处**：《楚辞·九章》"路漫漫其修远兮，吾将上下而求索"
- **寓意**：思虑深远，志向高远
- **五行**：思(金) 远(土)
- **音律**：阴平+上声，音调起伏有致
- **注意**：无明显问题

请严格按照此格式展示每个推荐的名字，确保拼音准确，并客观指出每个名字的优缺点。`
}
