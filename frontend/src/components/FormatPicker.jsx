import { formats } from '../formats'
import FormatCard from './FormatCard'
import styles from './FormatPicker.module.css'

export default function FormatPicker({ selectedFormat, onSelect }) {
  return (
    <section>
      <h2 className={styles.heading}>2. Choose a format</h2>
      <div className={styles.grid}>
        {formats.map((format) => (
          <FormatCard
            key={format.id}
            format={format}
            selected={selectedFormat === format.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
