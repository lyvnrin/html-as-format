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

      const endpoints = {
        magazine: '/api/render-magazine',
        'bubble-map': '/api/render-bubble',
      }
      const endpoint = endpoints[selectedFormat] || '/api/generate'
      const response = await fetch(endpoint, {
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
        <div className={styles.logo}>
          <span className={styles.tagPunct}>&lt;</span>
          html-as-a-format
          <span className={styles.tagPunct}>/&gt;</span>
        </div>
        <div className={styles.tagline}>Internal tool — source documents to shareable HTML pages</div>
      </header>

      <main className={styles.main}>
        <DropZone file={file} onFileSelect={setFile} />
        <FormatPicker selectedFormat={selectedFormat} onSelect={setSelectedFormat} />
      </main>

      <div className={styles.footerBar}>
        {error && <div className={styles.error}>{error}</div>}
        <button
          type="button"
          className={styles.generateButton}
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {isGenerating ? 'Generating…' : 'Generate page'}
        </button>
      </div>
    </div>
  )
}
