// src/mastra/tools/analyze-name.ts
import { createTool } from '@mastra/core'
import { z } from 'zod'
import { getCharacterInfo } from '@/lib/character'
import { analyzeSanCaiWuGe } from '@/lib/sancai-wuge'
import { analyzePhonetic, checkHarmony } from '@/lib/phonetic'
import { getRetriever } from '@/lib/rag'

export const analyzeNameTool = createTool({
  id: 'analyze-name',
  description: '全方位分析已有名字',
  inputSchema: z.object({
    fullName: z.string().describe('完整姓名'),
  }),
  outputSchema: z.object({
    characters: z.array(z.object({
      char: z.string(),
      pinyin: z.string(),
      wuxing: z.string(),
      strokes: z.number(),
    })),
    wuxingAnalysis: z.string(),
    sancaiAnalysis: z.object({
      tianCai: z.string(),
      renCai: z.string(),
      diCai: z.string(),
      fortune: z.string(),
    }).optional(),
    wugeAnalysis: z.object({
      tianGe: z.number(),
      renGe: z.number(),
      diGe: z.number(),
      waiGe: z.number(),
      zongGe: z.number(),
    }).optional(),
    phoneticAnalysis: z.string(),
    harmonyWarning: z.array(z.string()),
    classicReference: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { fullName } = context
    const chars = fullName.split('')

    // 分析每个字
    const characters = chars.map(char => {
      const info = getCharacterInfo(char)
      return info || { char, pinyin: '', wuxing: '-', strokes: 0 }
    })

    // 五行分析
    const wuxingList = characters.slice(1).map(c => c.wuxing).filter(w => w !== '-')
    const wuxingAnalysis = `名字五行：${wuxingList.join(' ')}`

    // 三才五格分析
    const sancaiWuge = analyzeSanCaiWuGe(fullName)

    // 音律分析
    const nameOnly = fullName.slice(1)
    const phonetic = analyzePhonetic(nameOnly)

    // 谐音检查
    const harmonyWarning = checkHarmony(fullName)

    // 典籍检索
    const retriever = getRetriever()
    const classicResults = await retriever.search(nameOnly, 1)
    const classicReference = classicResults[0]?.content

    return {
      characters,
      wuxingAnalysis,
      sancaiAnalysis: sancaiWuge?.sancai,
      wugeAnalysis: sancaiWuge?.wuge,
      phoneticAnalysis: phonetic.analysis,
      harmonyWarning,
      classicReference,
    }
  },
})
