// src/app/api/model/route.ts
import { NextRequest, NextResponse } from 'next/server'
import {
  loadModelConfig,
  saveModelConfig,
  getCurrentModel,
  getAvailableProviders,
  getModelsForProvider,
} from '@/lib/model-config'

/**
 * GET /api/model - 获取当前模型配置
 */
export async function GET() {
  const config = loadModelConfig()
  const current = getCurrentModel()
  const providers = getAvailableProviders()

  return NextResponse.json({
    current,
    providers,
    providerModels: Object.fromEntries(
      providers.map(p => [p, getModelsForProvider(p)])
    ),
    config,
  })
}

/**
 * POST /api/model - 更新模型配置
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, model } = body

    if (!provider || !model) {
      return NextResponse.json(
        { error: 'provider and model are required' },
        { status: 400 }
      )
    }

    const config = loadModelConfig()

    // 验证提供商和模型
    if (!config.providers[provider]) {
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      )
    }

    if (!config.providers[provider].models.includes(model)) {
      return NextResponse.json(
        { error: `Unknown model: ${model} for provider: ${provider}` },
        { status: 400 }
      )
    }

    // 更新配置
    config.provider = provider
    config.model = model
    saveModelConfig(config)

    return NextResponse.json({
      success: true,
      current: { provider, model },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update model config' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/model - 添加新的提供商或模型
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, models } = body

    if (!provider || !models || !Array.isArray(models)) {
      return NextResponse.json(
        { error: 'provider and models array are required' },
        { status: 400 }
      )
    }

    const config = loadModelConfig()

    if (!config.providers[provider]) {
      config.providers[provider] = { models: [] }
    }

    // 合并新模型
    const existingModels = new Set(config.providers[provider].models)
    for (const model of models) {
      existingModels.add(model)
    }
    config.providers[provider].models = Array.from(existingModels)

    saveModelConfig(config)

    return NextResponse.json({
      success: true,
      provider,
      models: config.providers[provider].models,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to add provider or models' },
      { status: 500 }
    )
  }
}
