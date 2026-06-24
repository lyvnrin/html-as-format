import { useState } from 'react'
import DropZone from './components/DropZone'
import FormatPicker from './components/FormatPicker'
import styles from './App.module.css'

function downloadHtml(html, filename) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function App() {
  const [file, setFile] = useState(null)
  const [selectedFormat, setSelectedFormat] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)

  const canGenerate = Boolean(file) && Boolean(selectedFormat) && !isGenerating

  async function handleGenerate() {
    setError(null)
    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('format', selectedFormat)

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Generation failed (${response.status})`)
      }

      const { html } = await response.json()
      downloadHtml(html, `${selectedFormat}.html`)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>HTML as a Format</div>
        <div className={styles.tagline}>Internal tool — source documents to shareable HTML pages</div>
      </header>

      <main className={styles.main}>
        <DropZone file={file} onFileSelect={setFile} />
        <FormatPicker selectedFormat={selectedFormat} onSelect={setSelectedFormat} />

        <div className={styles.generateRow}>
          <button
            type="button"
            className={styles.generateButton}
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            {isGenerating ? 'Generating…' : 'Generate page'}
          </button>
          {error && <div className={styles.error}>{error}</div>}
        </div>
      </main>
    </div>
  )
}
