import styles from './FormatCard.module.css'

// Small surface, so the tilt is capped more generously than the old
// whole-panel tilt (App.module.css used to cap at 1.5deg for its large
// surface) — otherwise it'd be barely perceptible on a card this size. Still
// modest enough that the card's own text stays readable while tilted.
const MAX_CARD_TILT_DEG = 6

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

  // Sets --card-tilt-x/-y directly on the DOM node (rather than via React
  // state) so continuous mousemove doesn't trigger a re-render per pixel —
  // same reasoning as the panel tilt this replaced.
  function handleCardMouseMove(e) {
    if (!active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    const normalizedX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const normalizedY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)

    card.style.transitionDuration = '0.2s'
    card.style.setProperty('--card-tilt-x', `${(-normalizedY * MAX_CARD_TILT_DEG).toFixed(2)}deg`)
    card.style.setProperty('--card-tilt-y', `${(normalizedX * MAX_CARD_TILT_DEG).toFixed(2)}deg`)
  }

  function handleCardMouseLeave(e) {
    const card = e.currentTarget
    card.style.transitionDuration = '0.5s'
    card.style.setProperty('--card-tilt-x', '0deg')
    card.style.setProperty('--card-tilt-y', '0deg')
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
      onMouseMove={handleCardMouseMove}
      onMouseLeave={handleCardMouseLeave}
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
