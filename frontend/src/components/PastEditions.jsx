import { useEffect, useMemo, useState } from 'react'
import { formats } from '../formats'
import styles from './PastEditions.module.css'

const FORMAT_LABELS = Object.fromEntries(formats.map((format) => [format.id, format.label]))

function downloadHtml(html, filename) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatDate(iso) {
  const date = new Date(iso)
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

export default function PastEditions() {
  const [editions, setEditions] = useState(null)
  const [error, setError] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/editions')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load past editions.')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setEditions(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredEditions = useMemo(() => {
    if (!editions) return []
    const q = query.trim().toLowerCase()
    if (!q) return editions
    return editions.filter((edition) => {
      const label = (FORMAT_LABELS[edition.format] || edition.format).toLowerCase()
      const filename = (edition.source_filename || '').toLowerCase()
      return filename.includes(q) || label.includes(q)
    })
  }, [editions, query])

  async function handleDownload(edition) {
    setError(null)
    setDownloadingId(edition.id)
    try {
      const res = await fetch(`/api/editions/${edition.id}`)
      if (!res.ok) throw new Error('Failed to load this edition.')
      const { html } = await res.json()
      downloadHtml(html, `${edition.format}.html`)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDelete(edition) {
    setError(null)
    setDeletingId(edition.id)
    try {
      const res = await fetch(`/api/editions/${edition.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete this edition.')
      setEditions((current) => current.filter((e) => e.id !== edition.id))
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm('Delete all past editions? This cannot be undone.')) return
    setError(null)
    try {
      const res = await fetch('/api/editions', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete past editions.')
      setEditions([])
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    }
  }

  if (error) {
    return <p className={styles.empty}>{error}</p>
  }

  if (editions === null) {
    return <p className={styles.empty}>Loading past editions…</p>
  }

  if (editions.length === 0) {
    return <p className={styles.empty}>Nothing generated yet — editions you generate will show up here.</p>
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.search}
          placeholder="Search by filename or format…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className={styles.deleteAll} onClick={handleDeleteAll}>
          Delete all
        </button>
      </div>

      {filteredEditions.length === 0 ? (
        <p className={styles.empty}>No editions match “{query}”.</p>
      ) : (
        <ul className={styles.list}>
          {filteredEditions.map((edition) => (
            <li key={edition.id}>
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.rowMain}
                  onClick={() => handleDownload(edition)}
                  disabled={downloadingId === edition.id}
                >
                  <span className={styles.format}>{FORMAT_LABELS[edition.format] || edition.format}</span>
                  <span className={styles.filename}>{edition.source_filename || 'Untitled source'}</span>
                  <span className={styles.date}>{formatDate(edition.started_at)}</span>
                  <span className={styles.downloadIcon} aria-hidden="true">
                    {downloadingId === edition.id ? '…' : '↓'}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.deleteOne}
                  aria-label="Delete this edition"
                  disabled={deletingId === edition.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(edition)
                  }}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
