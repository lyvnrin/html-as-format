import { useState } from 'react'
import { formats } from '../formats'
import FormatCard from './FormatCard'
import styles from './FormatPicker.module.css'

const CONTENT_TYPES = [
  { id: 'text', label: 'Text-heavy' },
  { id: 'image', label: 'Image-heavy' },
  { id: 'both', label: 'Both' },
]

export default function FormatPicker({ selectedFormat, onSelect }) {
  const [contentType, setContentType] = useState(null)

  function handleContentTypeClick(id) {
    setContentType((current) => (current === id ? null : id))
  }

  return (
    <section>
      <div className={styles.eyebrow}>&lt;step n="02"/&gt;</div>
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

      <div className={styles.grid}>
        {formats.map((format, index) => (
          <FormatCard
            key={format.id}
            format={format}
            index={index}
            selected={selectedFormat === format.id}
            recommended={contentType !== null && format.contentType === contentType}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
