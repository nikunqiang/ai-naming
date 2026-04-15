// src/lib/session.ts
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import type { Session, FormData, NameResult } from '@/types'

const SESSIONS_DIR = path.join(process.cwd(), 'data', 'sessions')

// 确保会话目录存在
function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

/**
 * 创建新会话
 */
export function createSession(mode: 'naming' | 'analyze'): Session {
  ensureSessionsDir()

  const session: Session = {
    sessionId: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mode,
    messages: [],
  }

  saveSession(session)
  return session
}

/**
 * 保存会话
 */
export function saveSession(session: Session): void {
  ensureSessionsDir()

  session.updatedAt = new Date().toISOString()
  const filePath = path.join(SESSIONS_DIR, `${session.sessionId}.json`)
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
}

/**
 * 加载会话
 */
export function loadSession(sessionId: string): Session | null {
  ensureSessionsDir()

  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`)
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as Session
  } catch {
    return null
  }
}

/**
 * 更新表单数据
 */
export function updateFormData(sessionId: string, formData: FormData): Session | null {
  const session = loadSession(sessionId)
  if (!session) return null

  session.formData = formData
  saveSession(session)
  return session
}

/**
 * 添加消息
 */
export function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Session | null {
  const session = loadSession(sessionId)
  if (!session) return null

  session.messages.push({ role, content })
  saveSession(session)
  return session
}

/**
 * 更新生成的名字
 */
export function updateGeneratedNames(
  sessionId: string,
  names: NameResult[]
): Session | null {
  const session = loadSession(sessionId)
  if (!session) return null

  session.generatedNames = names
  saveSession(session)
  return session
}

/**
 * 获取所有会话列表
 */
export function listSessions(): Session[] {
  ensureSessionsDir()

  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))
  const sessions: Session[] = []

  for (const file of files) {
    const content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8')
    try {
      sessions.push(JSON.parse(content))
    } catch {
      // ignore invalid files
    }
  }

  return sessions.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): boolean {
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    return true
  }
  return false
}
