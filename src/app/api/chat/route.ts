// src/app/api/chat/route.ts
import { Anthropic } from '@anthropic-ai/sdk'
import { loadModelConfig } from '@/lib/model-config'
import { getSystemPrompt } from '@/lib/llm'
import { getDislikedChars, getDislikedNames } from '@/lib/db'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { messages, pipelineContext } = await req.json()
    const config = loadModelConfig()

    // Build system prompt with pipeline context if available
    const systemPrompt = getSystemPrompt({
      dislikedChars: getDislikedChars(),
      dislikedNames: getDislikedNames().map(n => n.name),
    })
    const fullSystem = pipelineContext
      ? `${systemPrompt}\n\n**当前取名上下文：**\n${pipelineContext}\n\n请基于以上上下文继续为用户服务。如果用户要求调整，请推荐新的名字（使用【名字】格式）或对已有名字给出建议。`
      : systemPrompt

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    })

    const stream = await client.messages.stream({
      model: config.model,
      max_tokens: 4096,
      system: fullSystem,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    // Vercel AI SDK Data Stream Protocol 格式
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // 发送消息开始
          const messageId = `msg_${Date.now()}`
          controller.enqueue(encoder.encode(`f:{"messageId":"${messageId}"}\n`))

          let fullText = ''
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const text = event.delta.text
              fullText += text
              // 文本增量格式
              controller.enqueue(encoder.encode(`0:"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"\n`))
            }
          }

          // 发送完成信号
          controller.enqueue(encoder.encode(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`))
          controller.enqueue(encoder.encode('d:{"finishReason":"stop"}\n'))
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
