// src/lib/rag/embeddings.ts
import fs from 'fs'
import path from 'path'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'bge-m3'
const CACHE_FILE = path.join(process.cwd(), 'data', 'embedding_cache.json')

// 嵌入缓存
let cache: Record<string, number[]> = {}

/**
 * 加载嵌入缓存
 */
function loadCache(): void {
  if (Object.keys(cache).length > 0) return
  try {
    if (fs.existsSync(CACHE_FILE)) {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
      console.log(`Loaded ${Object.keys(cache).length} cached embeddings`)
    }
  } catch {
    cache = {}
  }
}

/**
 * 保存嵌入缓存
 */
function saveCache(): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf-8')
  } catch (err) {
    console.error('Failed to save embedding cache:', err)
  }
}

/**
 * 获取文本的向量嵌入（通过 Ollama bge-m3）
 */
export async function getEmbeddings(text: string): Promise<number[]> {
  loadCache()

  // 检查缓存
  if (cache[text]) return cache[text]

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
    })

    if (!response.ok) {
      console.error(`Ollama embedding failed (${response.status}), falling back to char-freq`)
      return getCharFreqEmbedding(text)
    }

    const data = await response.json()
    const embedding: number[] = data.embedding

    if (!embedding || embedding.length === 0) {
      return getCharFreqEmbedding(text)
    }

    // 缓存结果
    cache[text] = embedding
    saveCache()

    return embedding
  } catch (err) {
    console.error('Ollama embedding error, falling back to char-freq:', err)
    return getCharFreqEmbedding(text)
  }
}

/**
 * 字频向量（降级方案，当 Ollama 不可用时使用）
 */
function getCharFreqEmbedding(text: string): number[] {
  const vector = new Array(256).fill(0)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) % 256
    vector[code]++
  }
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) vector[i] /= magnitude
  }
  return vector
}

/**
 * 计算余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    magnitudeA += a[i] * a[i]
    magnitudeB += b[i] * b[i]
  }

  magnitudeA = Math.sqrt(magnitudeA)
  magnitudeB = Math.sqrt(magnitudeB)

  if (magnitudeA === 0 || magnitudeB === 0) return 0
  return dotProduct / (magnitudeA * magnitudeB)
}

/**
 * 预计算所有条目的嵌入并缓存
 */
export async function precomputeEmbeddings(entries: string[]): Promise<void> {
  loadCache()

  let newCount = 0
  for (const text of entries) {
    if (!cache[text]) {
      const embedding = await getEmbeddings(text)
      cache[text] = embedding
      newCount++
    }
  }

  if (newCount > 0) {
    saveCache()
    console.log(`Precomputed ${newCount} new embeddings (total: ${Object.keys(cache).length})`)
  }
}
