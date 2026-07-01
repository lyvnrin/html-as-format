import { useRef, useState } from 'react'
import styles from './DropZone.module.css'

const ACCEPTED_EXTENSIONS = ['.pdf', '.pptx', '.txt']

function hasAcceptedExtension(filename) {
  const lower = filename.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
      <div className={styles.eyebrow}>&lt;step n="01"/&gt;</div>
      <h2 className={styles.heading}>Upload a source file</h2>
      <div
        className={`${styles.zone} ${isDragOver ? styles.dragOver : ''} ${file ? styles.filled : ''}`}
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
          <div className={styles.chip}>
            <svg className={styles.fileIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 2.5h6l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path d="M11 2.5v4h4" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <span className={styles.filename}>{file.name}</span>
            <span className={styles.filesize}>{formatSize(file.size)}</span>
            <button
              type="button"
              className={styles.clearButton}
              aria-label="Remove file"
              onClick={(e) => {
                e.stopPropagation()
                onFileSelect(null)
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <div className={styles.promptRow}>
            <svg className={styles.uploadIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 13V4M10 4 6 8M10 4l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div className={styles.promptText}>
              <span className={styles.prompt}>Drag and drop a file, or click to browse</span>
              <span className={styles.hint}>Accepts .pdf, .pptx, .txt</span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
