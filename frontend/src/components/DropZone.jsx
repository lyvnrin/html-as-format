import { useRef, useState } from 'react'
import styles from './DropZone.module.css'

const ACCEPTED_EXTENSIONS = ['.pdf', '.pptx', '.txt']

function hasAcceptedExtension(filename) {
  const lower = filename.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export default function DropZone({ file, onFileSelect }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef(null)

  function handleFiles(fileList) {
    const picked = fileList?.[0]
    if (picked && hasAcceptedExtension(picked.name)) {
      onFileSelect(picked)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <section>
      <h2 className={styles.heading}>1. Upload a source file</h2>
      <div
        className={`${styles.zone} ${isDragOver ? styles.dragOver : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.pptx,.txt"
          className={styles.hiddenInput}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {file ? (
          <div className={styles.filename}>{file.name}</div>
        ) : (
          <>
            <div className={styles.prompt}>Drag and drop a file here, or click to browse</div>
            <div className={styles.hint}>Accepts .pdf, .pptx, .txt</div>
          </>
        )}
      </div>
    </section>
  )
}
