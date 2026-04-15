// src/mastra/tools/search-classic.ts
import { createTool } from '@mastra/core'
import { z } from 'zod'
import { getRetriever } from '@/lib/rag'

export const searchClassicTool = createTool({
  id: 'search-classic',
  description: '从诗经、楚辞等典籍中检索相关句子，用于取名灵感',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词或语义描述'),
    topK: z.number().optional().describe('返回数量，默认5'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      source: z.string(),
      content: z.string(),
      relevance: z.number(),
    })),
  }),
  execute: async ({ context }) => {
    const retriever = getRetriever()
    const results = await retriever.search(context.query, context.topK || 5)
    return { results }
  },
})

export const searchClassicByKeywordTool = createTool({
  id: 'search-classic-keyword',
  description: '按关键词在典籍中精确搜索',
  inputSchema: z.object({
    keyword: z.string().describe('搜索关键词'),
    topK: z.number().optional().describe('返回数量，默认5'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      source: z.string(),
      content: z.string(),
      relevance: z.number(),
    })),
  }),
  execute: async ({ context }) => {
    const retriever = getRetriever()
    const results = await retriever.searchByKeyword(context.keyword, context.topK || 5)
    return { results }
  },
})
