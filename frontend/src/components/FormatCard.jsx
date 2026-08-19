import styles from './FormatCard.module.css'

// Root can't be a <button> now that it needs to contain a real, independently
// clickable <a> preview link — a <button> may not contain interactive
// content, so a role="button" div plus manual Enter/Space handling stands in
// for the native element instead.
export default function FormatCard({ format, index, selected, anySelected, recommended, onSelect }) {
  const { label, description, active, Cover, previewUrl } = format

  function handleKeyDown(e) {
    if (!active) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(selected ? null : format.id)
    }
  }

  return (
    <div
      role="button"
      tabIndex={active ? 0 : -1}
      className={`${styles.card} ${selected ? styles.selected : ''} ${
        !selected && anySelected ? styles.notSelected : ''
      } ${recommended && active ? styles.recommended : ''} ${!active ? styles.disabled : ''}`}
      style={{ '--card-index': index }}
      onClick={() => active && onSelect(selected ? null : format.id)}
      onKeyDown={handleKeyDown}
      aria-pressed={selected}
      aria-disabled={!active}
    >
      <div className={styles.coverWrap}>
        <Cover />
        {!active && <span className={styles.badge}>Coming soon</span>}
      </div>
      <div className={styles.body}>
        <div className={styles.labelRow}>
          <div className={styles.label}>{label}</div>
          {active && recommended && <span className={styles.recommendedTag}>Recommended</span>}
        </div>
        <div className={styles.description}>{description}</div>
        {active && previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.previewLink}
            onClick={(e) => e.stopPropagation()}
          >
            Preview example ↗
          </a>
        )}
      </div>
    </div>
  )
}
