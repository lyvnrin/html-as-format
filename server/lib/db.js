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

// html_content was added after the initial schema — CREATE TABLE IF NOT EXISTS
// won't retrofit it onto a database file created before this column existed.
try {
  db.exec('ALTER TABLE generation_logs ADD COLUMN html_content TEXT')
} catch {
  // column already exists
}

const insertStmt = db.prepare(
  `INSERT INTO generation_logs (format, source_filename, started_at, status) VALUES (?, ?, ?, 'in_progress')`,
)
const updateStmt = db.prepare(
  `UPDATE generation_logs SET ended_at = ?, status = ?, duration_ms = ?, html_content = ? WHERE id = ?`,
)
const listStmt = db.prepare(
  `SELECT id, format, source_filename, started_at, ended_at, status, duration_ms
   FROM generation_logs
   WHERE status = 'completed' AND html_content IS NOT NULL
   ORDER BY started_at DESC`,
)
const getHtmlStmt = db.prepare(
  `SELECT format, source_filename, html_content FROM generation_logs WHERE id = ? AND status = 'completed'`,
)
const deleteStmt = db.prepare(`DELETE FROM generation_logs WHERE id = ?`)
const deleteAllStmt = db.prepare(`DELETE FROM generation_logs WHERE html_content IS NOT NULL`)

export function startGenerationLog({ format, filename }) {
  const startedAt = new Date()
  const result = insertStmt.run(format, filename ?? null, startedAt.toISOString())
  return { id: result.lastInsertRowid, startedAt }
}

export function finishGenerationLog(log, status, { html } = {}) {
  const endedAt = new Date()
  const durationMs = endedAt.getTime() - log.startedAt.getTime()
  updateStmt.run(endedAt.toISOString(), status, durationMs, html ?? null, log.id)
}

export function listGenerationLogs() {
  return listStmt.all()
}

export function getGenerationHtml(id) {
  return getHtmlStmt.get(id)
}

export function deleteGenerationLog(id) {
  deleteStmt.run(id)
}

export function deleteAllGenerationLogs() {
  deleteAllStmt.run()
}
