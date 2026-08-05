import { useEffect, useRef, useState } from 'react'
import DropZone from './components/DropZone'
import FormatPicker from './components/FormatPicker'
import DotField from './components/DotField'
import styles from './App.module.css'

const LOGO_TEXT = 'HTML as a Format'

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

function getInitialTheme() {
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [file, setFile] = useState(null)
  const [selectedFormat, setSelectedFormat] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [theme, setTheme] = useState(getInitialTheme)
  const abortControllerRef = useRef(null)

  const canGenerate = Boolean(file) && Boolean(selectedFormat) && !isGenerating

  useEffect(() => {
    function abortInFlightRequest() {
      abortControllerRef.current?.abort()
    }
    window.addEventListener('pagehide', abortInFlightRequest)
    return () => window.removeEventListener('pagehide', abortInFlightRequest)
  }, [])

  useEffect(() => {
    document.body.dataset.theme = theme
    window.localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  async function handleGenerate() {
    setError(null)
    setIsGenerating(true)
    const controller = new AbortController()
    abortControllerRef.current = controller
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('format', selectedFormat)

      const endpoints = {
        gallery: '/api/render-gallery',
        'bubble-map': '/api/render-bubble',
      }
      const endpoint = endpoints[selectedFormat] || '/api/generate'
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Generation failed (${response.status})`)
      }

      const { html } = await response.json()
      downloadHtml(html, `${selectedFormat}.html`)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong.')
      }
    } finally {
      abortControllerRef.current = null
      setIsGenerating(false)
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort()
  }

  return (
    <div className={styles.page}>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <DotField
          dotRadius={1.5}
          dotSpacing={14}
          bulgeStrength={67}
          glowRadius={160}
          sparkle={false}
          waveAmplitude={0}
          cursorRadius={500}
          cursorForce={0.1}
          bulgeOnly
          gradientFrom="#D4D1CB"
          gradientTo="#D4D1CB"
          glowColor="rgba(107, 140, 174, 0.3)"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={theme === 'dark'}
      >
        {theme === 'dark' ? (
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.6 4.4l-1.4 1.4M5.8 14.2l-1.4 1.4M15.6 15.6l-1.4-1.4M5.8 5.8 4.4 4.4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M17.2 12.4A7.5 7.5 0 0 1 7.6 2.8a7.5 7.5 0 1 0 9.6 9.6Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <header className={styles.header}>
        <div className={styles.logo} aria-label={LOGO_TEXT}>
          {LOGO_TEXT.split('').map((char, i) => (
            <span key={i} className={styles.logoCharWrap} aria-hidden="true">
              <span className={styles.logoChar} style={{ '--char-index': i }}>
                {char === ' ' ? ' ' : char}
              </span>
            </span>
          ))}
        </div>
        <div className={styles.tagline}>
          <p className={styles.taglineMain}>Internal tool — turn source documents into shareable HTML pages.</p>
          <p className={styles.taglineSub}>
            Drop a file, pick a layout, and generate a standalone page you can send anywhere — no
            build step, no hosting required.
          </p>
        </div>
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
        {isGenerating && (
          <button type="button" className={styles.cancelButton} onClick={handleCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
