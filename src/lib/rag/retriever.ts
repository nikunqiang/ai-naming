// src/lib/rag/retriever.ts
import fs from 'fs'
import path from 'path'
import { getEmbeddings, cosineSimilarity } from './embeddings'
import type { ClassicSearchResult } from '@/types'

// 典籍条目
interface ClassicEntry {
  source: string
  content: string
  embedding?: number[]
}

export class ClassicRetriever {
  private entries: ClassicEntry[] = []
  private initialized = false

  /**
   * 初始化，加载典籍数据
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // 加载诗经
    const shijingPath = path.join(process.cwd(), 'data', 'shijing.json')
    if (fs.existsSync(shijingPath)) {
      const shijing = JSON.parse(fs.readFileSync(shijingPath, 'utf-8'))
      for (const poem of shijing) {
        const source = `诗经·${poem.chapter}·${poem.section}·${poem.title}`
        for (const line of poem.content || []) {
          this.entries.push({
            source,
            content: line,
          })
        }
      }
    }

    // 加载楚辞
    const chuciPath = path.join(process.cwd(), 'data', 'chuci.json')
    if (fs.existsSync(chuciPath)) {
      const chuci = JSON.parse(fs.readFileSync(chuciPath, 'utf-8'))
      for (const poem of chuci) {
        const source = `楚辞·${poem.section}·${poem.title}`
        for (const line of poem.content || []) {
          this.entries.push({
            source,
            content: line,
          })
        }
      }
    }

    // 加载唐诗
    const tangshiPath = path.join(process.cwd(), 'data', 'tangshi.json')
    if (fs.existsSync(tangshiPath)) {
      const tangshi = JSON.parse(fs.readFileSync(tangshiPath, 'utf-8'))
      for (const poem of tangshi) {
        const source = `唐诗·${poem.author}·${poem.title}`
        for (const line of poem.content || []) {
          this.entries.push({ source, content: line })
        }
      }
    }

    // 加载宋词
    const songciPath = path.join(process.cwd(), 'data', 'songci.json')
    if (fs.existsSync(songciPath)) {
      const songci = JSON.parse(fs.readFileSync(songciPath, 'utf-8'))
      for (const poem of songci) {
        const source = `宋词·${poem.author}·${poem.title}`
        for (const line of poem.content || []) {
          this.entries.push({ source, content: line })
        }
      }
    }

    // 加载论语
    const lunyuPath = path.join(process.cwd(), 'data', 'lunyu.json')
    if (fs.existsSync(lunyuPath)) {
      const lunyu = JSON.parse(fs.readFileSync(lunyuPath, 'utf-8'))
      for (const item of lunyu) {
        const source = `论语·${item.chapter || '论语'}`
        this.entries.push({ source, content: item.content })
      }
    }

    this.initialized = true
    console.log(`Loaded ${this.entries.length} classic entries`)
  }

  /**
   * 搜索相关诗句
   */
  async search(query: string, topK: number = 5): Promise<ClassicSearchResult[]> {
    await this.initialize()

    const queryEmbedding = await getEmbeddings(query)

    // 计算相似度
    const results: Array<{ entry: ClassicEntry; similarity: number }> = []

    for (const entry of this.entries) {
      // 懒加载嵌入
      if (!entry.embedding) {
        entry.embedding = await getEmbeddings(entry.content)
      }

      const similarity = cosineSimilarity(queryEmbedding, entry.embedding)
      results.push({ entry, similarity })
    }

    // 排序并返回 topK
    results.sort((a, b) => b.similarity - a.similarity)

    return results.slice(0, topK).map(r => ({
      source: r.entry.source,
      content: r.entry.content,
      relevance: r.similarity,
    }))
  }

  /**
   * 按关键词搜索（分词匹配：任一关键词命中即返回）
   */
  async searchByKeyword(keyword: string, topK: number = 5): Promise<ClassicSearchResult[]> {
    await this.initialize()

    // Split into individual keywords (by space, comma, etc.)
    const keywords = keyword.split(/[\s,，、]+/).filter(k => k.length > 0)
    if (keywords.length === 0) return []

    const results: ClassicSearchResult[] = []
    const seen = new Set<string>()

    for (const entry of this.entries) {
      // Check if any keyword is found in the content
      const matched = keywords.some(kw => entry.content.includes(kw))
      if (matched) {
        const key = `${entry.source}:${entry.content}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({
            source: entry.source,
            content: entry.content,
            relevance: 1.0,
          })
        }
        if (results.length >= topK) break
      }
    }

    return results
  }

  /**
   * 获取适合取名的句子
   */
  async getSuitableForNaming(theme: string, topK: number = 5): Promise<ClassicSearchResult[]> {
    // 添加取名相关的上下文
    const query = `${theme} 美好 寓意 名字`
    return this.search(query, topK)
  }

  /**
   * 混合检索：语义搜索 + 关键词搜索
   */
  async hybridSearch(query: string, topK: number = 10): Promise<ClassicSearchResult[]> {
    await this.initialize()

    // 语义搜索 top 20
    const semanticResults = await this.search(query, 20)

    // 关键词搜索 top 5
    const keywordResults = await this.searchByKeyword(query, 5)

    // 合并去重
    const seen = new Set<string>()
    const merged: ClassicSearchResult[] = []

    for (const r of [...semanticResults, ...keywordResults]) {
      const key = `${r.source}:${r.content}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(r)
      }
    }

    // 按相关度排序，取 topK
    merged.sort((a, b) => b.relevance - a.relevance)
    return merged.slice(0, topK)
  }
}

// 单例
let retrieverInstance: ClassicRetriever | null = null

export function getRetriever(): ClassicRetriever {
  if (!retrieverInstance) {
    retrieverInstance = new ClassicRetriever()
  }
  return retrieverInstance
}
