// src/mastra/tools/generate-names.ts
import { createTool } from '@mastra/core'
import { z } from 'zod'
import { getCharacterInfo, getNameChars, getCharsByWuxing } from '@/lib/character'
import { getRetriever } from '@/lib/rag'

export const generateNamesTool = createTool({
  id: 'generate-names',
  description: '根据需求参数生成候选名字',
  inputSchema: z.object({
    surname: z.string().describe('姓氏'),
    gender: z.enum(['男', '女', '未定']).describe('性别'),
    wuxingRequired: z.array(z.string()).optional().describe('需要的五行属性'),
    expectations: z.array(z.string()).optional().describe('期望寓意'),
    avoidChars: z.array(z.string()).optional().describe('避免用字'),
    nameLength: z.union([z.literal(1), z.literal(2), z.literal('不限')]).optional().describe('名字字数'),
    count: z.number().optional().describe('生成数量，默认10'),
  }),
  outputSchema: z.object({
    names: z.array(z.object({
      name: z.string(),
      pinyin: z.string(),
      wuxing: z.array(z.string()),
      strokes: z.array(z.number()),
      source: z.string().optional(),
      meaning: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const count = context.count || 10
    const names: Array<{
      name: string
      pinyin: string
      wuxing: string[]
      strokes: number[]
      source?: string
      meaning: string
    }> = []

    // 获取候选字
    let candidateChars = getNameChars(context.gender === '未定' ? undefined : context.gender as 'boy' | 'girl' | undefined)

    // 按五行筛选
    if (context.wuxingRequired && context.wuxingRequired.length > 0) {
      const wuxingChars = context.wuxingRequired.flatMap(wx => getCharsByWuxing(wx))
      candidateChars = candidateChars.filter(c => wuxingChars.includes(c))
    }

    // 排除避免用字
    if (context.avoidChars) {
      candidateChars = candidateChars.filter(c => !context.avoidChars.includes(c))
    }

    // 从典籍中获取灵感
    const retriever = getRetriever()
    let classicResults: Array<{ source: string; content: string }> = []
    if (context.expectations && context.expectations.length > 0) {
      const query = context.expectations.join(' ')
      classicResults = await retriever.search(query, 10)
    }

    // 生成名字
    const nameLength = context.nameLength === '不限' ? 2 : (context.nameLength || 2)

    for (let i = 0; i < count && i < candidateChars.length; i++) {
      const char1 = candidateChars[i]
      const info1 = getCharacterInfo(char1)
      if (!info1) continue

      if (nameLength === 1) {
        names.push({
          name: context.surname + char1,
          pinyin: info1.pinyin,
          wuxing: [info1.wuxing],
          strokes: [info1.strokes],
          meaning: `寓意美好`,
        })
      } else {
        // 双字名
        for (let j = i + 1; j < candidateChars.length && names.length < count; j++) {
          const char2 = candidateChars[j]
          const info2 = getCharacterInfo(char2)
          if (!info2) continue

          const fullName = context.surname + char1 + char2
          const source = classicResults[i % classicResults.length]

          names.push({
            name: fullName,
            pinyin: `${info1.pinyin} ${info2.pinyin}`,
            wuxing: [info1.wuxing, info2.wuxing],
            strokes: [info1.strokes, info2.strokes],
            source: source?.content ? `「${source.content}」(${source.source})` : undefined,
            meaning: `寓意美好`,
          })
        }
      }
    }

    return { names: names.slice(0, count) }
  },
})
