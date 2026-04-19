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

/** 获取所有已保存的名字（全名） */
export function getSavedNames(): string[] {
  return (getDB().prepare("SELECT name FROM names").all() as Array<{ name: string }>).map(r => r.name)
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
