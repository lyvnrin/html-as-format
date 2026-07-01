import styles from './FormatCard.module.css'

export default function FormatCard({ format, index, selected, onSelect }) {
  const { label, description, active, Cover } = format

  return (
    <button
      type="button"
      className={`${styles.card} ${selected ? styles.selected : ''} ${!active ? styles.disabled : ''}`}
      style={{ '--card-index': index }}
      onClick={() => active && onSelect(format.id)}
      disabled={!active}
      aria-pressed={selected}
    >
      <div className={styles.coverWrap}>
        <Cover />
        {!active && <span className={styles.badge}>Coming soon</span>}
      </div>
      <div className={styles.body}>
        <div className={styles.label}>{label}</div>
        <div className={styles.description}>{description}</div>
      </div>
    </button>
  )
}
