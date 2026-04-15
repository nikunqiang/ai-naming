// src/lib/model-config.ts
import fs from 'fs'
import path from 'path'

export interface ModelProvider {
  models: string[]
  baseUrl?: string
}

export interface ModelConfig {
  provider: string
  model: string
  providers: Record<string, ModelProvider>
}

const CONFIG_PATH = path.join(process.cwd(), 'model.config.json')

let cachedConfig: ModelConfig | null = null

/**
 * 加载模型配置
 */
export function loadModelConfig(): ModelConfig {
  if (cachedConfig) return cachedConfig

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8')
      cachedConfig = JSON.parse(content) as ModelConfig
      return cachedConfig!
    }
  } catch (error) {
    console.warn('Failed to load model config, using defaults:', error)
  }

  // 默认配置
  cachedConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    providers: {
      anthropic: { models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'] },
      openai: { models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
      google: { models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
      deepseek: { models: ['deepseek-chat', 'deepseek-reasoner'] },
      ollama: { models: ['qwen2.5:14b', 'llama3.1:8b', 'deepseek-r1:7b'] },
    },
  }
  return cachedConfig
}

/**
 * 保存模型配置
 */
export function saveModelConfig(config: ModelConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
  cachedConfig = config
}

/**
 * 获取当前配置的提供商和模型
 */
export function getCurrentModel(): { provider: string; model: string } {
  const config = loadModelConfig()
  return { provider: config.provider, model: config.model }
}

/**
 * 获取所有可用的提供商
 */
export function getAvailableProviders(): string[] {
  const config = loadModelConfig()
  return Object.keys(config.providers)
}

/**
 * 获取指定提供商的模型列表
 */
export function getModelsForProvider(provider: string): string[] {
  const config = loadModelConfig()
  return config.providers[provider]?.models || []
}

/**
 * 获取提供商的 baseUrl（如果有）
 */
export function getProviderBaseUrl(provider: string): string | undefined {
  const config = loadModelConfig()
  return config.providers[provider]?.baseUrl
}
