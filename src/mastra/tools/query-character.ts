// src/mastra/tools/query-character.ts
import { createTool } from '@mastra/core'
import { z } from 'zod'
import { getCharacterInfo, getCharsByWuxing } from '@/lib/character'

export const queryCharacterTool = createTool({
  id: 'query-character',
  description: '查询汉字的详细信息，包括拼音、五行、笔画等',
  inputSchema: z.object({
    char: z.string().describe('要查询的汉字'),
  }),
  outputSchema: z.object({
    char: z.string(),
    pinyin: z.string(),
    wuxing: z.string(),
    strokes: z.number(),
  }),
  execute: async ({ context }) => {
    const info = getCharacterInfo(context.char)
    if (!info) {
      throw new Error(`未找到汉字 "${context.char}" 的信息`)
    }
    return info
  },
})

export const queryCharacterByWuxingTool = createTool({
  id: 'query-character-by-wuxing',
  description: '按五行属性筛选汉字',
  inputSchema: z.object({
    wuxing: z.enum(['金', '木', '水', '火', '土']).describe('五行属性'),
    limit: z.number().optional().describe('返回数量限制'),
  }),
  outputSchema: z.object({
    chars: z.array(z.string()),
    count: z.number(),
  }),
  execute: async ({ context }) => {
    const chars = getCharsByWuxing(context.wuxing)
    const limit = context.limit || 20
    return {
      chars: chars.slice(0, limit),
      count: chars.length,
    }
  },
})
