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
