// src/lib/rag/embeddings.ts

/**
 * 获取文本的向量嵌入
 * 使用简单的字符频率向量作为示例
 * 生产环境应使用 OpenAI embeddings 或本地模型
 */
export async function getEmbeddings(text: string): Promise<number[]> {
  // 简化版：使用字符频率作为向量
  // 生产环境应替换为真实的 embedding 模型
  const vector = new Array(256).fill(0)

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) % 256
    vector[code]++
  }

  // 归一化
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude
    }
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
