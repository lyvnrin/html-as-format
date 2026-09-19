import { useEffect, useState } from 'react'
import { formats as knownFormats } from '../formats'
import { authHeaders } from '../apiHeaders'
import GenericCover from '../covers/GenericCover'
import FormatCard from './FormatCard'
import styles from './FormatPicker.module.css'

const CONTENT_TYPES = [
  { id: 'text', label: 'Text-heavy' },
  { id: 'image', label: 'Image-heavy' },
  { id: 'both', label: 'Both' },
]

function capitalize(name) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// Backend names come from GET /api/formats — the skills/render-<name>/
// folder name with "render-" stripped. Anything with curated metadata in
// formats.js (matched by backendName) renders as before; a newly dropped
// render-<name>/ folder with no curated entry yet still shows up, just with
// a generic cover/description instead of one hand-authored for it.
function toDisplayFormat(backendName) {
  const known = knownFormats.find((format) => format.backendName === backendName)
  if (known) return known
  return {
    id: backendName,
    backendName,
    label: capitalize(backendName),
    description: 'A renderer without a curated preview yet.',
    active: true,
    contentType: null,
    Cover: GenericCover,
    previewUrl: undefined,
  }
}

export default function FormatPicker({ selectedFormat, onSelect }) {
  const [contentType, setContentType] = useState(null)
  const [backendNames, setBackendNames] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/formats', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load available formats.')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setBackendNames(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleContentTypeClick(id) {
    setContentType((current) => (current === id ? null : id))
  }

  const formats = (backendNames || []).map(toDisplayFormat)

  return (
    <section>
      <h2 className={styles.heading}>Choose a format</h2>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Is your source file:</span>
        <div className={styles.pills}>
          {CONTENT_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`${styles.pill} ${contentType === type.id ? styles.pillActive : ''}`}
              onClick={() => handleContentTypeClick(type.id)}
              aria-pressed={contentType === type.id}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.grid}>
        {formats.map((format, index) => (
          <FormatCard
            key={format.id}
            format={format}
            index={index}
            selected={selectedFormat === format.id}
            anySelected={selectedFormat !== null}
            recommended={contentType !== null && format.contentType === contentType}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
