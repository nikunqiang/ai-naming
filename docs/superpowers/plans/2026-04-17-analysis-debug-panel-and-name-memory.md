# 分析调试面板 + 名字记忆 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 analyze API 改为 SSE 流式推送结构化步骤事件，前端添加调试面板实时展示推导过程；用 better-sqlite3 建立名字记忆数据库，支持自动记录、标签分类、偏好过滤。

**Architecture:** 后端 analyze route 改为 SSE 流式响应，每个计算步骤推送结构化事件，LLM 改用 stream()。前端结果页添加可折叠调试面板消费 SSE 事件。新增 better-sqlite3 数据访问层和 REST API，新建记忆页和结果页偏好交互。

**Tech Stack:** Next.js 14, TypeScript, SSE (Server-Sent Events), better-sqlite3, Tailwind CSS, vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/analysis-events.ts` | Create | SSE 事件类型定义 |
| `src/lib/db.ts` | Create | better-sqlite3 数据访问层 |
| `src/lib/__tests__/db.test.ts` | Create | 数据库测试 |
| `src/app/api/analyze/route.ts` | Modify | 改为 SSE 流式响应 |
| `src/app/api/names/route.ts` | Create | 名字 CRUD API (GET/POST) |
| `src/app/api/names/[id]/route.ts` | Create | 单个名字 API (PATCH/DELETE) |
| `src/app/api/names/stats/route.ts` | Create | 名字统计 API |
| `src/app/api/tags/route.ts` | Create | 标签 API (GET/POST) |
| `src/components/DebugPanel.tsx` | Create | 调试面板组件 |
| `src/components/NameMemoryCard.tsx` | Create | 名字记忆卡片组件 |
| `src/app/results/page.tsx` | Modify | 集成调试面板 + 偏好交互 |
| `src/app/memory/page.tsx` | Create | 名字记忆页 |
| `src/app/page.tsx` | Modify | 添加记忆入口 |
| `src/lib/llm.ts` | Modify | 取名 prompt 注入排除列表 |

---

### Task 1: 安装 better-sqlite3 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 better-sqlite3 及类型**

```bash
cd D:/dev/git/ai-naming && npm install better-sqlite3 && npm install -D @types/better-sqlite3
```

- [ ] **Step 2: 验证安装**

```bash
cd D:/dev/git/ai-naming && node -e "const db = require('better-sqlite3')(':memory:'); console.log('better-sqlite3 OK, version:', db.prepare('select sqlite_version() as v').get().v); db.close()"
```

Expected: `better-sqlite3 OK, version: 3.x.x`

- [ ] **Step 3: Commit**

```bash
cd D:/dev/git/ai-naming && git add package.json package-lock.json && git commit -m "chore: add better-sqlite3 and @types/better-sqlite3"
```

---

### Task 2: 添加 SSE 事件类型定义

**Files:**
- Create: `src/types/analysis-events.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
// src/types/analysis-events.ts

/** 分析步骤名称 */
export type AnalysisStep =
  | 'chars' | 'wuxing' | 'benefit' | 'sancai'
  | 'phonetic' | 'harmony' | 'glyph' | 'popularity'
  | 'prompt' | 'ai'

/** SSE 步骤事件 */
export interface StepEvent {
  step: AnalysisStep
  status: 'running' | 'done' | 'error'
  duration?: number
  summary?: string
  detail?: Record<string, unknown>
  prompt?: string
  systemPrompt?: string
  chunk?: string
  result?: string
  error?: string
}

/** SSE 完成事件 */
export interface CompleteEvent {
  type: 'complete'
  data: Record<string, unknown>
}

/** 联合类型 */
export type AnalysisEvent = StepEvent | CompleteEvent

/** 步骤中文标签映射 */
export const STEP_LABELS: Record<AnalysisStep, string> = {
  chars: '解析汉字信息',
  wuxing: '计算八字五行',
  benefit: '分析五行补益',
  sancai: '分析三才五格',
  phonetic: '分析音律搭配',
  harmony: '检查谐音',
  glyph: '分析字形结构',
  popularity: '检查重名率',
  prompt: '构建提示词',
  ai: 'AI深度分析',
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/types/analysis-events.ts && git commit -m "feat: add SSE analysis event type definitions"
```

---

### Task 3: 创建 better-sqlite3 数据访问层

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/__tests__/db.test.ts`

- [ ] **Step 1: 写数据库测试**

```typescript
// src/lib/__tests__/db.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

// 用内存数据库测试
let db: Database.Database

// 直接测试 SQL 逻辑，不依赖 db.ts 的单例
function createTestDB(): Database.Database {
  const testDb = new Database(':memory:')
  testDb.pragma('journal_mode = WAL')
  testDb.pragma('foreign_keys = ON')

  testDb.exec(`
    CREATE TABLE names (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      surname TEXT NOT NULL,
      given_name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'analyze',
      session_id TEXT,
      preference TEXT NOT NULL DEFAULT 'neutral',
      score INTEGER,
      scores_json TEXT,
      analysis_summary TEXT,
      birth_time TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      is_preset INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE name_tags (
      name_id INTEGER NOT NULL REFERENCES names(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (name_id, tag_id)
    );
    CREATE INDEX idx_names_preference ON names(preference);
    CREATE INDEX idx_names_source ON names(source);
    CREATE INDEX idx_name_tags_name ON name_tags(name_id);
  `)
  return testDb
}

describe('names table', () => {
  beforeAll(() => { db = createTestDB() })
  afterAll(() => { db.close() })

  it('inserts and retrieves a name', () => {
    const insert = db.prepare(
      "INSERT INTO names (name, surname, given_name, source, score, scores_json) VALUES (?, ?, ?, ?, ?, ?)"
    )
    insert.run('李婉清', '李', '婉清', 'analyze', 78, '{"wuxingBenefit":13}')

    const row = db.prepare("SELECT * FROM names WHERE name = ?").get('李婉清') as any
    expect(row.name).toBe('李婉清')
    expect(row.surname).toBe('李')
    expect(row.given_name).toBe('婉清')
    expect(row.score).toBe(78)
    expect(row.preference).toBe('neutral')
  })

  it('enforces UNIQUE on name (upsert)', () => {
    const upsert = db.prepare(`
      INSERT INTO names (name, surname, given_name, source, score, scores_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        score = excluded.score,
        scores_json = excluded.scores_json,
        updated_at = datetime('now','localtime')
    `)
    upsert.run('李婉清', '李', '婉清', 'analyze', 82, '{"wuxingBenefit":15}')

    const row = db.prepare("SELECT * FROM names WHERE name = ?").get('李婉清') as any
    expect(row.score).toBe(82)
    // Should still be only 1 row
    const count = (db.prepare("SELECT COUNT(*) as c FROM names WHERE name = ?").get('李婉清') as any).c
    expect(count).toBe(1)
  })

  it('updates preference', () => {
    db.prepare("UPDATE names SET preference = ? WHERE name = ?").run('liked', '李婉清')
    const row = db.prepare("SELECT preference FROM names WHERE name = ?").get('李婉清') as any
    expect(row.preference).toBe('liked')
  })

  it('gets disliked chars', () => {
    db.prepare("INSERT INTO names (name, surname, given_name, source, preference) VALUES (?, ?, ?, ?, ?)").run('王大刚', '王', '大刚', 'analyze', 'disliked')
    const disliked = db.prepare("SELECT given_name FROM names WHERE preference = 'disliked'").all() as any[]
    const chars = new Set<string>()
    for (const row of disliked) {
      for (const ch of row.given_name) chars.add(ch)
    }
    expect(chars.has('大')).toBe(true)
    expect(chars.has('刚')).toBe(true)
  })
})

describe('tags table', () => {
  beforeAll(() => { db = createTestDB() })
  afterAll(() => { db.close() })

  it('inserts preset tags', () => {
    const insert = db.prepare("INSERT INTO tags (name, category, is_preset) VALUES (?, ?, 1)")
    insert.run('喜欢', 'preference')
    insert.run('文学', 'style')

    const tags = db.prepare("SELECT * FROM tags ORDER BY id").all() as any[]
    expect(tags.length).toBe(2)
    expect(tags[0].name).toBe('喜欢')
    expect(tags[1].category).toBe('style')
  })

  it('associates tags with names', () => {
    db.prepare("INSERT INTO names (name, surname, given_name, source) VALUES (?, ?, ?, ?)").run('李思齐', '李', '思齐', 'analyze')
    const nameId = (db.prepare("SELECT id FROM names WHERE name = ?").get('李思齐') as any).id
    const tagId = (db.prepare("SELECT id FROM tags WHERE name = ?").get('喜欢') as any).id

    db.prepare("INSERT INTO name_tags (name_id, tag_id) VALUES (?, ?)").run(nameId, tagId)

    const result = db.prepare(`
      SELECT t.name FROM name_tags nt
      JOIN tags t ON t.id = nt.tag_id
      WHERE nt.name_id = ?
    `).all(nameId) as any[]
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('喜欢')
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/db.test.ts
```

Expected: PASS

- [ ] **Step 3: 创建 db.ts 数据访问层**

```typescript
// src/lib/db.ts
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'naming.db')

let db: Database.Database | null = null

/** 获取数据库实例（单例，自动初始化） */
export function getDB(): Database.Database {
  if (db) return db

  // 确保 data 目录存在
  const dataDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initSchema(db)
  initPresetTags(db)

  return db
}

/** 建表 */
function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS names (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      surname TEXT NOT NULL,
      given_name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'analyze',
      session_id TEXT,
      preference TEXT NOT NULL DEFAULT 'neutral',
      score INTEGER,
      scores_json TEXT,
      analysis_summary TEXT,
      birth_time TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      is_preset INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS name_tags (
      name_id INTEGER NOT NULL REFERENCES names(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (name_id, tag_id)
    );
  `)

  // 创建索引（IF NOT EXISTS 不支持 CREATE INDEX，用 try-catch）
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_names_preference ON names(preference)',
    'CREATE INDEX IF NOT EXISTS idx_names_source ON names(source)',
    'CREATE INDEX IF NOT EXISTS idx_names_created ON names(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_name_tags_name ON name_tags(name_id)',
    'CREATE INDEX IF NOT EXISTS idx_name_tags_tag ON name_tags(tag_id)',
  ]
  for (const sql of indexes) database.exec(sql)
}

/** 插入预设标签 */
function initPresetTags(database: Database.Database): void {
  const presets: Array<{ name: string; category: string }> = [
    { name: '喜欢', category: 'preference' },
    { name: '一般', category: 'preference' },
    { name: '不喜欢', category: 'preference' },
    { name: '传统', category: 'style' },
    { name: '文学', category: 'style' },
    { name: '现代', category: 'style' },
    { name: '大气', category: 'style' },
    { name: '婉约', category: 'style' },
    { name: '阳刚', category: 'style' },
    { name: '金', category: 'wuxing' },
    { name: '木', category: 'wuxing' },
    { name: '水', category: 'wuxing' },
    { name: '火', category: 'wuxing' },
    { name: '土', category: 'wuxing' },
  ]
  const insert = database.prepare(
    "INSERT OR IGNORE INTO tags (name, category, is_preset) VALUES (?, ?, 1)"
  )
  for (const tag of presets) insert.run(tag.name, tag.category)
}

/** 保存名字（upsert） */
export function saveName(params: {
  name: string; surname: string; givenName: string
  source: string; sessionId?: string; score?: number
  scoresJson?: string; analysisSummary?: string; birthTime?: string
}): number {
  const database = getDB()
  const stmt = database.prepare(`
    INSERT INTO names (name, surname, given_name, source, session_id, score, scores_json, analysis_summary, birth_time)
    VALUES (@name, @surname, @givenName, @source, @sessionId, @score, @scoresJson, @analysisSummary, @birthTime)
    ON CONFLICT(name) DO UPDATE SET
      score = excluded.score,
      scores_json = excluded.scores_json,
      analysis_summary = excluded.analysis_summary,
      session_id = COALESCE(excluded.session_id, names.session_id),
      updated_at = datetime('now','localtime')
  `)
  const result = stmt.run({
    name: params.name,
    surname: params.surname,
    givenName: params.givenName,
    source: params.source,
    sessionId: params.sessionId ?? null,
    score: params.score ?? null,
    scoresJson: params.scoresJson ?? null,
    analysisSummary: params.analysisSummary ?? null,
    birthTime: params.birthTime ?? null,
  })
  return result.lastInsertRowid as number
}

/** 更新偏好 */
export function updatePreference(nameId: number, preference: 'liked' | 'neutral' | 'disliked'): void {
  getDB().prepare("UPDATE names SET preference = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(preference, nameId)
}

/** 添加标签 */
export function addTag(nameId: number, tagName: string): void {
  const database = getDB()
  // 确保 tag 存在
  database.prepare("INSERT OR IGNORE INTO tags (name, category, is_preset) VALUES (?, 'custom', 0)").run(tagName)
  const tag = database.prepare("SELECT id FROM tags WHERE name = ?").get(tagName) as { id: number } | undefined
  if (tag) {
    database.prepare("INSERT OR IGNORE INTO name_tags (name_id, tag_id) VALUES (?, ?)").run(nameId, tag.id)
  }
}

/** 移除标签 */
export function removeTag(nameId: number, tagName: string): void {
  const database = getDB()
  const tag = database.prepare("SELECT id FROM tags WHERE name = ?").get(tagName) as { id: number } | undefined
  if (tag) {
    database.prepare("DELETE FROM name_tags WHERE name_id = ? AND tag_id = ?").run(nameId, tag.id)
  }
}

/** 查询单个名字 */
export function getName(name: string): Record<string, unknown> | undefined {
  return getDB().prepare("SELECT * FROM names WHERE name = ?").get(name) as Record<string, unknown> | undefined
}

/** 列出名字（支持筛选） */
export function listNames(filters: {
  preference?: string; tag?: string; search?: string
  limit?: number; offset?: number
}): Array<Record<string, unknown>> {
  const database = getDB()
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (filters.preference) {
    conditions.push('n.preference = @preference')
    params.preference = filters.preference
  }
  if (filters.search) {
    conditions.push('n.name LIKE @search')
    params.search = `%${filters.search}%`
  }
  if (filters.tag) {
    conditions.push(`EXISTS (SELECT 1 FROM name_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.name_id = n.id AND t.name = @tag)`)
    params.tag = filters.tag
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  return database.prepare(
    `SELECT n.*, GROUP_CONCAT(t.name) as tag_names FROM names n LEFT JOIN name_tags nt ON nt.name_id = n.id LEFT JOIN tags t ON t.id = nt.tag_id ${where} GROUP BY n.id ORDER BY n.updated_at DESC LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit, offset }) as Array<Record<string, unknown>>
}

/** 获取不喜欢的名字列表 */
export function getDislikedNames(): Array<{ name: string; given_name: string }> {
  return getDB().prepare("SELECT name, given_name FROM names WHERE preference = 'disliked'").all() as Array<{ name: string; given_name: string }>
}

/** 获取不喜欢名字中的所有字 */
export function getDislikedChars(): string[] {
  const disliked = getDislikedNames()
  const chars = new Set<string>()
  for (const row of disliked) {
    for (const ch of row.given_name) chars.add(ch)
  }
  return Array.from(chars)
}

/** 删除名字 */
export function deleteName(nameId: number): void {
  getDB().prepare("DELETE FROM names WHERE id = ?").run(nameId)
}

/** 获取所有标签 */
export function getAllTags(): Array<Record<string, unknown>> {
  return getDB().prepare("SELECT * FROM tags ORDER BY category, id").all() as Array<Record<string, unknown>>
}

/** 创建自定义标签 */
export function createTag(name: string, category: string = 'custom'): number {
  const result = getDB().prepare("INSERT OR IGNORE INTO tags (name, category, is_preset) VALUES (?, ?, 0)").run(name, category)
  return result.lastInsertRowid as number
}

/** 统计信息 */
export function getStats(): { total: number; liked: number; neutral: number; disliked: number } {
  const database = getDB()
  const total = (database.prepare("SELECT COUNT(*) as c FROM names").get() as { c: number }).c
  const liked = (database.prepare("SELECT COUNT(*) as c FROM names WHERE preference = 'liked'").get() as { c: number }).c
  const disliked = (database.prepare("SELECT COUNT(*) as c FROM names WHERE preference = 'disliked'").get() as { c: number }).c
  return { total, liked, neutral: total - liked - disliked, disliked }
}
```

- [ ] **Step 4: 运行全部测试**

```bash
cd D:/dev/git/ai-naming && npx vitest run
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/lib/db.ts src/lib/__tests__/db.test.ts && git commit -m "feat: add better-sqlite3 data access layer with names/tags tables"
```

---

### Task 4: 创建名字和标签 API 路由

**Files:**
- Create: `src/app/api/names/route.ts`
- Create: `src/app/api/names/[id]/route.ts`
- Create: `src/app/api/names/stats/route.ts`
- Create: `src/app/api/tags/route.ts`

- [ ] **Step 1: 创建 /api/names 路由 (GET + POST)**

```typescript
// src/app/api/names/route.ts
import { listNames, saveName } from '@/lib/db'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const preference = url.searchParams.get('preference') || undefined
  const tag = url.searchParams.get('tag') || undefined
  const search = url.searchParams.get('search') || undefined
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  const names = listNames({ preference, tag, search, limit, offset })
  return Response.json(names)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = saveName({
      name: body.name,
      surname: body.surname,
      givenName: body.givenName,
      source: body.source || 'analyze',
      sessionId: body.sessionId,
      score: body.score,
      scoresJson: body.scoresJson ? JSON.stringify(body.scoresJson) : undefined,
      analysisSummary: body.analysisSummary,
      birthTime: body.birthTime,
    })
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
```

- [ ] **Step 2: 创建 /api/names/[id] 路由 (PATCH + DELETE)**

```typescript
// src/app/api/names/[id]/route.ts
import { updatePreference, addTag, removeTag, deleteName } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    const body = await req.json()

    if (body.preference) {
      updatePreference(id, body.preference)
    }
    if (body.addTag) {
      addTag(id, body.addTag)
    }
    if (body.removeTag) {
      removeTag(id, body.removeTag)
    }

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    deleteName(id)
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
```

- [ ] **Step 3: 创建 /api/names/stats 路由**

```typescript
// src/app/api/names/stats/route.ts
import { getStats } from '@/lib/db'

export async function GET() {
  return Response.json(getStats())
}
```

- [ ] **Step 4: 创建 /api/tags 路由 (GET + POST)**

```typescript
// src/app/api/tags/route.ts
import { getAllTags, createTag } from '@/lib/db'

export async function GET() {
  return Response.json(getAllTags())
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = createTag(body.name, body.category || 'custom')
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/app/api/names/ src/app/api/tags/ && git commit -m "feat: add names and tags REST API routes"
```

---

### Task 5: 改造 analyze API 为 SSE 流式响应

**Files:**
- Modify: `src/app/api/analyze/route.ts`

这是最核心的改造。将当前的 JSON POST 响应改为 SSE 流式推送。

- [ ] **Step 1: 重写 route.ts 为 SSE 流式**

将 `src/app/api/analyze/route.ts` 完整替换为以下内容：

```typescript
// src/app/api/analyze/route.ts
import { Anthropic } from '@anthropic-ai/sdk'
import { loadModelConfig } from '@/lib/model-config'
import { getCharacterInfo } from '@/lib/character'
import { analyzeSanCaiWuGe, analyzeSanCaiWuGeEnhanced } from '@/lib/sancai-wuge'
import { analyzePhonetic, checkHarmony } from '@/lib/phonetic'
import { calculateBaZi, parseBirthTime, analyzeWuxingBenefit } from '@/lib/wuxing'
import { analyzeGlyph } from '@/lib/glyph'
import { analyzeNamePopularity } from '@/lib/popularity'
import { createSession, addMessage } from '@/lib/session'
import { getAnalysisSystemPrompt } from '@/lib/llm'
import { saveName } from '@/lib/db'
import type { StepEvent, CompleteEvent } from '@/types/analysis-events'

export const maxDuration = 60

/** SSE 辅助：发送事件 */
function sendEvent(controller: ReadableStreamDefaultController, event: StepEvent | CompleteEvent): void {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
}

/** 计时辅助 */
function timed<T>(fn: () => T): { result: T; duration: number } {
  const start = Date.now()
  const result = fn()
  return { result, duration: Date.now() - start }
}

export async function POST(req: Request) {
  const { name, birthTime, sessionId } = await req.json()
  const config = loadModelConfig()

  if (!name || name.length < 2) {
    return new Response(JSON.stringify({ error: '请输入有效的姓名' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 创建或使用现有会话
  let currentSessionId = sessionId
  if (!currentSessionId) {
    const session = createSession('analyze')
    currentSessionId = session.sessionId
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ① 字符查询
        sendEvent(controller, { step: 'chars', status: 'running' })
        const { result: charInfos, duration: charsDuration } = timed(() => {
          const chars = name.split('')
          return chars.map((char: string) => getCharacterInfo(char) || { char, pinyin: '', wuxing: '-', strokes: 0 })
        })
        sendEvent(controller, {
          step: 'chars', status: 'done', duration: charsDuration,
          summary: charInfos.map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => `${c.char}:${c.wuxing}:${c.strokes}画`).join(', '),
          detail: { charInfos, source: 'char_info.json' },
        })

        // ② 八字五行
        let baZi = null
        sendEvent(controller, { step: 'wuxing', status: 'running' })
        const { result: wuxingResult, duration: wuxingDuration } = timed(() => {
          if (!birthTime) return null
          const parsed = parseBirthTime(birthTime)
          if (!parsed) return null
          return calculateBaZi(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute)
        })
        baZi = wuxingResult
        sendEvent(controller, {
          step: 'wuxing', status: 'done', duration: wuxingDuration,
          summary: baZi ? `${baZi.yearGan}${baZi.yearZhi} ${baZi.monthGan}${baZi.monthZhi} ${baZi.dayGan}${baZi.dayZhi} ${baZi.timeGan}${baZi.timeZhi}` : '未提供出生时间',
          detail: baZi ? { bazi: baZi, source: 'lunar-javascript' } : { skipped: true, reason: '未提供出生时间' },
        })

        // ③ 五行补益
        let wuxingBenefit = null
        sendEvent(controller, { step: 'benefit', status: 'running' })
        const { result: benefitResult, duration: benefitDuration } = timed(() => {
          if (!baZi) return null
          const nameWuxing = charInfos.slice(1).map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => c.wuxing).filter((w: string) => w !== '-')
          return analyzeWuxingBenefit(baZi, nameWuxing)
        })
        wuxingBenefit = benefitResult
        sendEvent(controller, {
          step: 'benefit', status: 'done', duration: benefitDuration,
          summary: wuxingBenefit ? `喜用神: ${wuxingBenefit.xiYong.join('、')}，忌神: ${wuxingBenefit.jiShen.join('、')}，得分: ${wuxingBenefit.score}/25` : '未提供八字',
          detail: wuxingBenefit ? { xiYong: wuxingBenefit.xiYong, jiShen: wuxingBenefit.jiShen, score: wuxingBenefit.score, nameBenefit: wuxingBenefit.nameBenefit } : { skipped: true },
        })

        // ④ 三才五格
        sendEvent(controller, { step: 'sancai', status: 'running' })
        const { result: sancaiResult, duration: sancaiDuration } = timed(() => ({
          enhanced: analyzeSanCaiWuGeEnhanced(name),
          basic: analyzeSanCaiWuGe(name),
        }))
        const { enhanced: sancaiWugeEnhanced, basic: sancaiWuge } = sancaiResult
        sendEvent(controller, {
          step: 'sancai', status: 'done', duration: sancaiDuration,
          summary: `三才${sancaiWugeEnhanced.sancaiLevel}，得分: ${sancaiWugeEnhanced.score}/20`,
          detail: { sancaiWugeEnhanced, sancaiWuge },
        })

        // ⑤ 音律分析
        const nameOnly = name.slice(1)
        sendEvent(controller, { step: 'phonetic', status: 'running' })
        const { result: phonetic, duration: phoneticDuration } = timed(() => analyzePhonetic(nameOnly))
        sendEvent(controller, {
          step: 'phonetic', status: 'done', duration: phoneticDuration,
          summary: `${phonetic.toneNames.join('→')}，得分: ${phonetic.score}/20`,
          detail: { pinyins: phonetic.pinyins, tones: phonetic.tones, toneNames: phonetic.toneNames, toneAnalysis: phonetic.toneAnalysis, rhymeAnalysis: phonetic.rhymeAnalysis, opennessAnalysis: phonetic.opennessAnalysis, score: phonetic.score },
        })

        // ⑥ 谐音检查
        sendEvent(controller, { step: 'harmony', status: 'running' })
        const { result: harmonyWarnings, duration: harmonyDuration } = timed(() => checkHarmony(name))
        sendEvent(controller, {
          step: 'harmony', status: 'done', duration: harmonyDuration,
          summary: harmonyWarnings.length > 0 ? `发现${harmonyWarnings.length}个谐音: ${harmonyWarnings.join('、')}` : '无谐音风险',
          detail: { warnings: harmonyWarnings, source: 'harmony_warnings.json' },
        })

        // ⑦ 字形分析
        const strokes = charInfos.map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => c.strokes)
        sendEvent(controller, { step: 'glyph', status: 'running' })
        const { result: glyph, duration: glyphDuration } = timed(() => analyzeGlyph(nameOnly, strokes.slice(1)))
        sendEvent(controller, {
          step: 'glyph', status: 'done', duration: glyphDuration,
          summary: `${glyph.strokeBalance}，${glyph.writingEase}，得分: ${glyph.score}/10`,
          detail: { glyph, charStructureSource: 'char_structure.json' },
        })

        // ⑧ 重名率
        sendEvent(controller, { step: 'popularity', status: 'running' })
        const { result: popularity, duration: popularityDuration } = timed(() => analyzeNamePopularity(nameOnly))
        sendEvent(controller, {
          step: 'popularity', status: 'done', duration: popularityDuration,
          summary: `重名率: ${popularity.level}（${popularity.count}次），得分: ${popularity.score}/5`,
          detail: { popularity, source: 'names_corpus_gender.txt' },
        })

        // ⑨ 构建提示词
        const userMessage = `请分析名字"${name}"${birthTime ? `，出生时间：${birthTime}` : ''}`
        addMessage(currentSessionId, 'user', userMessage)

        const analysisPrompt = buildAnalysisPrompt({
          name, charInfos, baZi, wuxingBenefit, sancaiWugeEnhanced, phonetic, harmonyWarnings, glyph, popularity,
        })
        const systemPrompt = getAnalysisSystemPrompt()

        sendEvent(controller, {
          step: 'prompt', status: 'done',
          summary: `提示词构建完成（${analysisPrompt.length}字）`,
          detail: { promptLength: analysisPrompt.length, systemPromptLength: systemPrompt.length },
          prompt: analysisPrompt,
          systemPrompt,
        })

        // ⑩ AI 流式分析
        sendEvent(controller, { step: 'ai', status: 'running' })
        const aiStart = Date.now()

        const client = new Anthropic({
          apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
          baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        })

        let analysisText = ''
        const stream = client.messages.stream({
          model: config.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: analysisPrompt }],
        })

        stream.on('text', (text: string) => {
          analysisText += text
          sendEvent(controller, { step: 'ai', status: 'running', chunk: text })
        })

        await stream.finalMessage()
        const aiDuration = Date.now() - aiStart

        sendEvent(controller, {
          step: 'ai', status: 'done', duration: aiDuration,
          summary: `AI分析完成（${analysisText.length}字，${(aiDuration / 1000).toFixed(1)}s）`,
          result: analysisText,
        })

        // 保存AI回复
        addMessage(currentSessionId, 'assistant', analysisText)

        // 构建完整结果
        const fullResult = {
          sessionId: currentSessionId,
          name,
          pinyin: charInfos.map((c: { char: string; pinyin: string; wuxing: string; strokes: number }) => c.pinyin).filter(Boolean).join(' '),
          charInfos, baZi, wuxingBenefit, sancaiWuge, sancaiWugeEnhanced,
          phonetic, harmonyWarnings, glyph, popularity,
          analysis: analysisText,
        }

        // 自动保存到记忆
        try {
          const surname = name.charAt(0)
          const givenName = name.slice(1)
          const totalScore = (wuxingBenefit?.score ?? 0) + (sancaiWugeEnhanced?.score ?? 0) + (phonetic?.score ?? 0) + (glyph?.score ?? 0) + (popularity?.score ?? 0)
          saveName({
            name, surname, givenName,
            source: 'analyze',
            sessionId: currentSessionId,
            score: totalScore,
            scoresJson: JSON.stringify({
              wuxingBenefit: wuxingBenefit?.score,
              sancaiWuge: sancaiWugeEnhanced?.score,
              phonetic: phonetic?.score,
              glyph: glyph?.score,
              popularity: popularity?.score,
            }),
            analysisSummary: analysisText.substring(0, 100),
            birthTime,
          })
        } catch (e) {
          console.error('Failed to save name to memory:', e)
        }

        // 发送完成事件
        sendEvent(controller, { type: 'complete', data: fullResult })
      } catch (error) {
        sendEvent(controller, { step: 'ai', status: 'error', error: String(error) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

/** 构建结构化分析提示词（保持与之前一致） */
function buildAnalysisPrompt(data: {
  name: string
  charInfos: Array<{ char: string; pinyin: string; wuxing: string; strokes: number }>
  baZi: any
  wuxingBenefit: any
  sancaiWugeEnhanced: any
  phonetic: any
  harmonyWarnings: string[]
  glyph: any
  popularity: any
}): string {
  const { name, charInfos, baZi, wuxingBenefit, sancaiWugeEnhanced, phonetic, harmonyWarnings, glyph, popularity } = data
  const lines: string[] = []
  lines.push(`请对名字"${name}"进行全面分析。`)
  lines.push('')
  lines.push('## 基本信息')
  lines.push(`- 姓名：${name}`)
  lines.push(`- 各字拼音：${charInfos.map(c => `${c.char}(${c.pinyin || '未知'})`).join(' ')}`)
  lines.push(`- 五行属性：${charInfos.slice(1).map(c => c.wuxing).join(' ')}`)
  lines.push(`- 笔画数：${charInfos.map(c => c.strokes).join('、')}`)
  if (baZi) {
    lines.push('')
    lines.push('## 八字信息')
    lines.push(`- 八字：${baZi.yearGan}${baZi.yearZhi} ${baZi.monthGan}${baZi.monthZhi} ${baZi.dayGan}${baZi.dayZhi} ${baZi.timeGan}${baZi.timeZhi}`)
    lines.push(`- 五行统计：金${baZi.wuxing.gold} 木${baZi.wuxing.wood} 水${baZi.wuxing.water} 火${baZi.wuxing.fire} 土${baZi.wuxing.earth}`)
    if (baZi.missing.length > 0) lines.push(`- 缺失五行：${baZi.missing.join('、')}`)
    lines.push(`- 主导五行：${baZi.dominant}`)
  }
  lines.push('')
  lines.push('## 预计算评分数据')
  if (wuxingBenefit) {
    lines.push(`- 五行补益得分：${wuxingBenefit.score}/25（喜用神：${wuxingBenefit.xiYong.join('、')}，忌神：${wuxingBenefit.jiShen.join('、')}）`)
    lines.push(`- 补益说明：${wuxingBenefit.nameBenefit}`)
  } else {
    lines.push(`- 五行补益得分：未提供八字，仅从字面分析（上限15分）`)
  }
  if (sancaiWugeEnhanced) {
    lines.push(`- 三才五格得分：${sancaiWugeEnhanced.score}/20（三才${sancaiWugeEnhanced.sancaiLevel}：${sancaiWugeEnhanced.sancaiFortune}）`)
    lines.push(`  - 天格${sancaiWugeEnhanced.tianGe.num}(${sancaiWugeEnhanced.tianGe.level}) 人格${sancaiWugeEnhanced.renGe.num}(${sancaiWugeEnhanced.renGe.level}) 地格${sancaiWugeEnhanced.diGe.num}(${sancaiWugeEnhanced.diGe.level}) 外格${sancaiWugeEnhanced.waiGe.num}(${sancaiWugeEnhanced.waiGe.level}) 总格${sancaiWugeEnhanced.zongGe.num}(${sancaiWugeEnhanced.zongGe.level})`)
  }
  lines.push(`- 音律得分：${phonetic.score}/20（${phonetic.analysis}）`)
  lines.push(`  - 声调：${phonetic.toneNames.join(' → ')}，${phonetic.toneAnalysis}`)
  lines.push(`  - 韵母：${phonetic.rhymeAnalysis}`)
  lines.push(`  - 开闭口音：${phonetic.opennessAnalysis}`)
  if (harmonyWarnings.length > 0) {
    lines.push(`- 谐音预警：${harmonyWarnings.join('、')}（音律得分已扣10分）`)
  }
  lines.push(`- 字形得分：${glyph.score}/10`)
  lines.push(`  - 笔画平衡：${glyph.strokeBalance}`)
  lines.push(`  - 书写便利：${glyph.writingEase}`)
  lines.push(`  - 视觉结构：${glyph.visualStructure}`)
  lines.push(`  - 生僻度：${glyph.rarity}`)
  lines.push(`- 时代适用得分：${popularity.score}/5（重名率：${popularity.level}，出现${popularity.count}次）`)
  lines.push(`- 字义内涵得分：待你评估（满分20分）`)
  lines.push('')
  lines.push('## 输出格式要求')
  lines.push('')
  lines.push('### 综合评分：XX/100')
  lines.push('')
  lines.push('### 各维度评分')
  lines.push('| 维度 | 得分 | 说明 |')
  lines.push('|------|------|------|')
  lines.push('| 五行配置 | XX/25 | ... |')
  lines.push('| 三才五格 | XX/20 | ... |')
  lines.push('| 音律听感 | XX/20 | ... |')
  lines.push('| 字义内涵 | XX/20 | ... |')
  lines.push('| 字形结构 | XX/10 | ... |')
  lines.push('| 时代适用 | XX/5 | ... |')
  lines.push('')
  lines.push('### 详细分析')
  lines.push('[各维度的专业解读，引用具体数据]')
  lines.push('')
  lines.push('### 专家点评')
  lines.push('[核心优缺点总结，犀利但不刻薄]')
  lines.push('')
  lines.push('### 改进建议')
  lines.push('[如总分<70，给出具体替代字建议]')
  return lines.join('\n')
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/app/api/analyze/route.ts && git commit -m "feat: convert analyze API to SSE streaming with structured step events"
```

---

### Task 6: 创建调试面板组件

**Files:**
- Create: `src/components/DebugPanel.tsx`

- [ ] **Step 1: 创建调试面板**

```tsx
// src/components/DebugPanel.tsx
'use client'

import { useState } from 'react'
import type { AnalysisStep, StepEvent } from '@/types/analysis-events'
import { STEP_LABELS } from '@/types/analysis-events'

interface StepState {
  status: 'pending' | 'running' | 'done' | 'error'
  duration?: number
  summary?: string
  detail?: Record<string, unknown>
  prompt?: string
  systemPrompt?: string
  chunks?: string
  result?: string
  error?: string
}

interface DebugPanelProps {
  steps: Record<string, StepState>
  totalTime?: number
}

export default function DebugPanel({ steps, totalTime }: DebugPanelProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  const stepOrder: AnalysisStep[] = ['chars', 'wuxing', 'benefit', 'sancai', 'phonetic', 'harmony', 'glyph', 'popularity', 'prompt', 'ai']

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100 font-mono text-xs overflow-hidden">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <span className="text-sm font-semibold">分析过程</span>
        {totalTime != null && (
          <span className="text-gray-400">总耗时 {(totalTime / 1000).toFixed(1)}s</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {stepOrder.map(stepKey => {
          const step = steps[stepKey]
          if (!step) return null
          const isExpanded = expandedStep === stepKey
          const label = STEP_LABELS[stepKey]

          return (
            <div key={stepKey} className="border-b border-gray-800">
              <button
                onClick={() => setExpandedStep(isExpanded ? null : stepKey)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-800 text-left"
              >
                <span className="w-4 text-center">
                  {step.status === 'done' ? '✓' : step.status === 'running' ? '⏳' : step.status === 'error' ? '✗' : '○'}
                </span>
                <span className={`flex-1 ${step.status === 'done' ? 'text-green-400' : step.status === 'error' ? 'text-red-400' : step.status === 'running' ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {label}
                </span>
                {step.duration != null && (
                  <span className="text-gray-500">{step.duration}ms</span>
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {step.summary && (
                    <div className="text-gray-300">{step.summary}</div>
                  )}
                  {step.error && (
                    <div className="text-red-400">{step.error}</div>
                  )}
                  {step.systemPrompt && (
                    <details className="text-gray-400">
                      <summary className="cursor-pointer text-gray-500">System Prompt</summary>
                      <pre className="mt-1 p-2 bg-gray-800 rounded overflow-x-auto whitespace-pre-wrap text-[10px] max-h-40 overflow-y-auto">{step.systemPrompt}</pre>
                    </details>
                  )}
                  {step.prompt && (
                    <details open>
                      <summary className="cursor-pointer text-gray-500">User Prompt</summary>
                      <pre className="mt-1 p-2 bg-gray-800 rounded overflow-x-auto whitespace-pre-wrap text-[10px] max-h-60 overflow-y-auto">{step.prompt}</pre>
                    </details>
                  )}
                  {step.chunks && (
                    <div>
                      <div className="text-gray-500 mb-1">AI 回复</div>
                      <pre className="p-2 bg-gray-800 rounded overflow-x-auto whitespace-pre-wrap text-[10px] max-h-60 overflow-y-auto">{step.chunks}</pre>
                    </div>
                  )}
                  {step.detail && !step.prompt && !step.chunks && (
                    <pre className="p-2 bg-gray-800 rounded overflow-x-auto whitespace-pre-wrap text-[10px] max-h-60 overflow-y-auto">{JSON.stringify(step.detail, null, 2)}</pre>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/components/DebugPanel.tsx && git commit -m "feat: add DebugPanel component for analysis step visualization"
```

---

### Task 7: 改造结果页 — 消费 SSE + 集成调试面板 + 偏好交互

**Files:**
- Modify: `src/app/results/page.tsx`

- [ ] **Step 1: 重写结果页**

将 `src/app/results/page.tsx` 的 analyze 模式改为消费 SSE，集成调试面板，添加偏好交互。

关键改动点：
1. 将 `fetch('/api/analyze')` 改为消费 SSE 流
2. 用 `steps` state 跟踪每个步骤的状态
3. 添加调试面板（右侧可折叠）
4. 分析完成后添加偏好按钮和"已保存到记忆"提示
5. 名字可点击重新分析

在 `runAnalysis` 函数中，替换原来的 fetch 逻辑为：

```typescript
// SSE 消费逻辑
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: name }),
})

const reader = response.body?.getReader()
const decoder = new TextDecoder()

if (!reader) throw new Error('No reader')

let buffer = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const json = line.slice(6)
    if (!json) continue

    try {
      const event = JSON.parse(json)

      if (event.type === 'complete') {
        // 用完整数据渲染结果
        const data = event.data
        // ... 设置 names state（与原逻辑相同）
      } else if (event.step) {
        // 更新步骤状态
        setSteps(prev => {
          const next = { ...prev }
          const stepState = { ...next[event.step] }
          stepState.status = event.status
          if (event.duration != null) stepState.duration = event.duration
          if (event.summary) stepState.summary = event.summary
          if (event.detail) stepState.detail = event.detail
          if (event.prompt) stepState.prompt = event.prompt
          if (event.systemPrompt) stepState.systemPrompt = event.systemPrompt
          if (event.chunk) {
            stepState.chunks = (stepState.chunks || '') + event.chunk
          }
          if (event.result) stepState.result = event.result
          if (event.error) stepState.error = event.error
          next[event.step] = stepState
          return next
        })
        // 更新当前步骤索引
        const stepIndex = ANALYSIS_STEPS.findIndex(s => s.key === event.step)
        if (stepIndex >= 0 && event.status === 'running') {
          setCurrentStep(stepIndex)
        }
      }
    } catch {
      // ignore parse errors
    }
  }
}
```

在页面布局中添加调试面板：

```tsx
{/* 调试面板切换按钮 */}
<button
  onClick={() => setShowDebug(!showDebug)}
  className="fixed right-4 top-20 z-50 p-2 rounded-sm bg-gray-800 text-gray-300 hover:bg-gray-700"
  title="调试面板"
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L17.25 17.25M6.75 17.25L6.75 6.75M3.75 12L20.25 12" />
  </svg>
</button>

{/* 调试面板 */}
{showDebug && (
  <div className="fixed right-0 top-0 h-full w-[40%] z-40 shadow-xl">
    <DebugPanel steps={steps} totalTime={Object.values(steps).reduce((sum, s) => sum + (s.duration || 0), 0)} />
  </div>
)}
```

在分析结果区域添加偏好交互：

```tsx
{/* 记忆偏好 */}
{mode === 'analyze' && !isLoading && names[0] && (
  <div className="card-elegant p-4 flex items-center gap-4">
    <span className="text-sm text-ink-500">已保存到记忆</span>
    <div className="flex gap-2">
      {(['liked', 'neutral', 'disliked'] as const).map(pref => (
        <button
          key={pref}
          onClick={() => {
            // 调用 PATCH /api/names/[id] 更新偏好
            if (names[0]?.nameId) {
              fetch(`/api/names/${names[0].nameId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preference: pref }),
              })
            }
          }}
          className={`px-3 py-1 rounded-sm text-sm ${pref === 'liked' ? 'bg-jade-50 text-jade-700' : pref === 'disliked' ? 'bg-red-50 text-red-700' : 'bg-ink-50 text-ink-600'}`}
        >
          {pref === 'liked' ? '喜欢' : pref === 'disliked' ? '不喜欢' : '一般'}
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/app/results/page.tsx && git commit -m "feat: integrate SSE consumption, debug panel, and preference UI in results page"
```

---

### Task 8: 创建名字记忆页

**Files:**
- Create: `src/app/memory/page.tsx`

- [ ] **Step 1: 创建记忆页**

```tsx
// src/app/memory/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface NameRecord {
  id: number
  name: string
  surname: string
  given_name: string
  preference: string
  score: number | null
  tag_names: string | null
  created_at: string
}

interface Stats {
  total: number
  liked: number
  neutral: number
  disliked: number
}

export default function MemoryPage() {
  const [names, setNames] = useState<NameRecord[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, liked: 0, neutral: 0, disliked: 0 })
  const [filter, setFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [filter, search])

  async function loadData() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter) params.set('preference', filter)
    if (search) params.set('search', search)

    const [namesRes, statsRes] = await Promise.all([
      fetch(`/api/names?${params}`),
      fetch('/api/names/stats'),
    ])
    setNames(await namesRes.json())
    setStats(await statsRes.json())
    setLoading(false)
  }

  async function setPreference(id: number, preference: string) {
    await fetch(`/api/names/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preference }),
    })
    loadData()
  }

  async function handleDelete(id: number) {
    await fetch(`/api/names/${id}`, { method: 'DELETE' })
    loadData()
  }

  return (
    <main className="min-h-screen ink-wash">
      <header className="sticky top-0 z-50 bg-ink-50/90 backdrop-blur-sm border-b border-ink-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-ink-400 hover:text-ink-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="font-serif-cn text-lg text-ink-700">名字记忆</h1>
          <span className="text-sm text-ink-400">{stats.total} 个名字</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* 统计栏 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { key: '', label: '全部', count: stats.total },
            { key: 'liked', label: '喜欢', count: stats.liked },
            { key: 'neutral', label: '一般', count: stats.neutral },
            { key: 'disliked', label: '不喜欢', count: stats.disliked },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`card-elegant p-3 text-center ${filter === key ? 'border-ink-800' : ''}`}
            >
              <div className="text-2xl font-serif-cn text-ink-900">{count}</div>
              <div className="text-xs text-ink-400 mt-1">{label}</div>
            </button>
          ))}
        </div>

        {/* 搜索 */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索名字..."
            className="input-field w-full"
          />
        </div>

        {/* 名字列表 */}
        {loading ? (
          <div className="text-center text-ink-400 py-12">加载中...</div>
        ) : names.length === 0 ? (
          <div className="text-center text-ink-400 py-12">
            <p className="font-serif-cn text-xl mb-2">还没有记录</p>
            <p className="text-sm">分析过的名字会自动保存在这里</p>
          </div>
        ) : (
          <div className="space-y-3">
            {names.map(item => (
              <div key={item.id} className="card-elegant p-4">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/results?name=${encodeURIComponent(item.name)}&mode=analyze`}
                    className="font-serif-cn text-2xl text-ink-900 hover:text-vermilion-600 transition-colors"
                  >
                    {item.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    {(['liked', 'neutral', 'disliked'] as const).map(pref => (
                      <button
                        key={pref}
                        onClick={() => setPreference(item.id, pref)}
                        className={`px-2 py-0.5 rounded-sm text-xs ${item.preference === pref ? 'bg-ink-800 text-ink-50' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'}`}
                      >
                        {pref === 'liked' ? '喜欢' : pref === 'disliked' ? '不喜欢' : '一般'}
                      </button>
                    ))}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-ink-300 hover:text-red-500 text-xs ml-2"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-sm text-ink-500">
                  {item.score != null && <span>评分: {item.score}</span>}
                  <span>来源: {item.source === 'analyze' ? '分析' : '生成'}</span>
                  {item.tag_names && (
                    <div className="flex gap-1">
                      {item.tag_names.split(',').map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-ink-50 rounded-sm text-xs">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/app/memory/page.tsx && git commit -m "feat: add name memory page with filtering, preference, and search"
```

---

### Task 9: 首页添加记忆入口 + 取名排除注入

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/lib/llm.ts`

- [ ] **Step 1: 在首页添加"名字记忆"卡片**

在 `src/app/page.tsx` 的两个卡片（取名、测名）后面，添加第三个卡片链接到 `/memory`：

```tsx
<a className="group card-elegant p-8 flex flex-col items-center justify-center hover:border-ink-600/30" style={{animationDelay:'0.3s'}} href="/memory">
  <div className="w-12 h-12 mb-4 flex items-center justify-center">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-ink-600 group-hover:text-ink-800 transition-colors">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.778-.715-1.652-2.377-2.778-4.313-2.778C5.1 3.75 3 5.765 3 8.25c0 7.79 9.563 13.06 12 14.25 2.437-1.19 12-6.46 12-14.25z" />
    </svg>
  </div>
  <span className="font-serif-cn text-xl text-ink-800 group-hover:text-ink-900 transition-colors">记忆</span>
  <span className="text-sm text-ink-400 mt-1">名字记录与偏好</span>
</a>
```

同时将卡片网格从 `grid-cols-2` 改为 `grid-cols-3`。

- [ ] **Step 2: 在取名系统提示词中注入排除列表**

在 `src/lib/llm.ts` 的 `getSystemPrompt()` 函数中，在返回的字符串末尾追加排除逻辑：

```typescript
export function getSystemPrompt(dislikedChars?: string[], dislikedNames?: string[]): string {
  let prompt = `你是一位专业、客观的中文取名顾问...` // 现有内容

  // 注入排除列表
  if (dislikedChars && dislikedChars.length > 0) {
    prompt += `\n\n**用户偏好排除规则：**\n- 以下字已被用户标记为不喜欢，请不要在推荐名字中使用：${dislikedChars.join('、')}`
  }
  if (dislikedNames && dislikedNames.length > 0) {
    prompt += `\n- 以下完整名字已被标记为不喜欢，请不要推荐：${dislikedNames.join('、')}`
  }

  return prompt
}
```

- [ ] **Step 3: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/app/page.tsx src/lib/llm.ts && git commit -m "feat: add memory entry on home page and disliked name exclusion in prompts"
```

---

### Task 10: 运行测试 + 构建验证 + 修复

- [ ] **Step 1: 运行 vitest**

```bash
cd D:/dev/git/ai-naming && npx vitest run
```

- [ ] **Step 2: 运行 TypeScript 类型检查**

```bash
cd D:/dev/git/ai-naming && npx tsc --noEmit
```

修复任何新增的类型错误（排除预存的 mastra 和 form/page.tsx 问题）。

- [ ] **Step 3: 运行 Next.js 构建**

```bash
cd D:/dev/git/ai-naming && npm run build
```

修复任何构建错误。

- [ ] **Step 4: Commit 修复（如有）**

```bash
cd D:/dev/git/ai-naming && git add -A && git commit -m "fix: resolve type and build errors from new features"
```

---

### Task 11: E2E 验证

- [ ] **Step 1: 启动开发服务器**

```bash
cd D:/dev/git/ai-naming && npm run dev
```

- [ ] **Step 2: 测试 analyze API SSE 流**

```bash
cd D:/dev/git/ai-naming && node -e "
const http = require('http');
const data = JSON.stringify({name: '李婉清'});
const options = {hostname:'localhost',port:3000,path:'/api/analyze',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
const req = http.request(options, res => {
  console.log('Status:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type']);
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const events = body.split('\n\n').filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6)));
    console.log('Events:', events.length);
    for (const e of events) {
      if (e.type === 'complete') console.log('Complete event received');
      else if (e.step) console.log('Step:', e.step, e.status, e.duration ? e.duration + 'ms' : '');
    }
  });
});
req.write(data);
req.end();
"
```

Expected: Multiple step events with running/done status, followed by a complete event.

- [ ] **Step 3: 测试名字记忆 API**

```bash
cd D:/dev/git/ai-naming && curl -s http://localhost:3000/api/names | head -100
cd D:/dev/git/ai-naming && curl -s http://localhost:3000/api/names/stats
cd D:/dev/git/ai-naming && curl -s http://localhost:3000/api/tags
```

- [ ] **Step 4: 测试记忆页**

在浏览器访问 http://localhost:3000/memory 确认页面正常渲染。

- [ ] **Step 5: 最终 Commit**

```bash
cd D:/dev/git/ai-naming && git add -A && git commit -m "chore: E2E verification complete for debug panel and name memory"
```
