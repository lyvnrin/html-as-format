import { formats } from '../formats'
import FormatCard from './FormatCard'
import styles from './FormatPicker.module.css'

export default function FormatPicker({ selectedFormat, onSelect }) {
  return (
    <section>
      <div className={styles.eyebrow}>&lt;step n="02"/&gt;</div>
      <h2 className={styles.heading}>Choose a format</h2>
      <div className={styles.grid}>
        {formats.map((format, index) => (
          <FormatCard
            key={format.id}
            format={format}
            index={index}
            selected={selectedFormat === format.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
