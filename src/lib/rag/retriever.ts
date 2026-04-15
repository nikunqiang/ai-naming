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
   * 按关键词搜索
   */
  async searchByKeyword(keyword: string, topK: number = 5): Promise<ClassicSearchResult[]> {
    await this.initialize()

    const results: ClassicSearchResult[] = []

    for (const entry of this.entries) {
      if (entry.content.includes(keyword)) {
        results.push({
          source: entry.source,
          content: entry.content,
          relevance: 1.0,
        })
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
}

// 单例
let retrieverInstance: ClassicRetriever | null = null

export function getRetriever(): ClassicRetriever {
  if (!retrieverInstance) {
    retrieverInstance = new ClassicRetriever()
  }
  return retrieverInstance
}
