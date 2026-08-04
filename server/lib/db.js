import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const DB_PATH = path.join(DATA_DIR, 'generation_logs.db')
const SCHEMA_PATH = path.join(ROOT, 'db/schema.sql')

fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf-8'))

const insertStmt = db.prepare(
  `INSERT INTO generation_logs (format, source_filename, started_at, status) VALUES (?, ?, ?, 'in_progress')`,
)
const updateStmt = db.prepare(
  `UPDATE generation_logs SET ended_at = ?, status = ?, duration_ms = ? WHERE id = ?`,
)

export function startGenerationLog({ format, filename }) {
  const startedAt = new Date()
  const result = insertStmt.run(format, filename ?? null, startedAt.toISOString())
  return { id: result.lastInsertRowid, startedAt }
}

export function finishGenerationLog(log, status) {
  const endedAt = new Date()
  const durationMs = endedAt.getTime() - log.startedAt.getTime()
  updateStmt.run(endedAt.toISOString(), status, durationMs, log.id)
}
