import { useRef } from 'react'
import styles from './FormatCard.module.css'

const MAX_TILT_DEG = 4
const MAX_PARALLAX_PX = 4

export default function FormatCard({ format, index, selected, anySelected, recommended, onSelect }) {
  const { label, description, active, Cover } = format
  const cardRef = useRef(null)

  function handleMouseMove(e) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const card = cardRef.current
    if (!card) return

    const rect = e.currentTarget.getBoundingClientRect()
    const normalizedX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const normalizedY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)

    card.style.transitionDuration = '0.15s'
    card.style.setProperty('--tilt-x', `${(-normalizedY * MAX_TILT_DEG).toFixed(2)}deg`)
    card.style.setProperty('--tilt-y', `${(normalizedX * MAX_TILT_DEG).toFixed(2)}deg`)
    card.style.setProperty('--parallax-x', `${(normalizedX * MAX_PARALLAX_PX).toFixed(2)}px`)
    card.style.setProperty('--parallax-y', `${(normalizedY * MAX_PARALLAX_PX).toFixed(2)}px`)
  }

  function handleMouseLeave() {
    const card = cardRef.current
    if (!card) return

    card.style.transitionDuration = '0.4s'
    card.style.setProperty('--tilt-x', '0deg')
    card.style.setProperty('--tilt-y', '0deg')
    card.style.setProperty('--parallax-x', '0px')
    card.style.setProperty('--parallax-y', '0px')
  }

  return (
    <button
      ref={cardRef}
      type="button"
      className={`${styles.card} ${selected ? styles.selected : ''} ${
        !selected && anySelected ? styles.notSelected : ''
      } ${recommended && active ? styles.recommended : ''} ${!active ? styles.disabled : ''}`}
      style={{ '--card-index': index }}
      onClick={() => active && onSelect(selected ? null : format.id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      disabled={!active}
      aria-pressed={selected}
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
      </div>
    </button>
  )
}
