import { useEffect, useRef, useState } from 'react'
import DropZone from './components/DropZone'
import FormatPicker from './components/FormatPicker'
import Grainient from './components/Grainient'
import PastEditions from './components/PastEditions'
import styles from './App.module.css'

const LOGO_TEXT = 'HTML as a Format'
const MAX_CONTAINER_TILT_DEG = 1.5

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
  const [activeTab, setActiveTab] = useState('generation')
  const abortControllerRef = useRef(null)
  const contentPanelRef = useRef(null)

  const canGenerate = Boolean(file) && Boolean(selectedFormat) && !isGenerating

  function handleContentPanelMouseMove(e) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const panel = contentPanelRef.current
    if (!panel) return

    const rect = e.currentTarget.getBoundingClientRect()
    const normalizedX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const normalizedY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)

    panel.style.transitionDuration = '0.2s'
    panel.style.setProperty('--tilt-x', `${(-normalizedY * MAX_CONTAINER_TILT_DEG).toFixed(2)}deg`)
    panel.style.setProperty('--tilt-y', `${(normalizedX * MAX_CONTAINER_TILT_DEG).toFixed(2)}deg`)
  }

  function handleContentPanelMouseLeave() {
    const panel = contentPanelRef.current
    if (!panel) return

    panel.style.transitionDuration = '0.5s'
    panel.style.setProperty('--tilt-x', '0deg')
    panel.style.setProperty('--tilt-y', '0deg')
  }

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
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <Grainient
          color1="#a8cbe8"
          color2="#4a8ad4"
          color3="#1e5a96"
          grainAmount={0.06}
          contrast={1.2}
          saturation={0.9}
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

      <div
        className={styles.contentPanel}
        ref={contentPanelRef}
        onMouseMove={handleContentPanelMouseMove}
        onMouseLeave={handleContentPanelMouseLeave}
      >
        <header className={styles.header}>
          <div className={styles.logo}>{LOGO_TEXT}</div>
          <div className={styles.tagline}>
            <p className={styles.taglineMain}>
              This internal tool turns your source documents into shareable HTML pages.
            </p>
            <p className={styles.taglineSub}>
              Drop a file, pick a layout, and click generate. The page downloads straight to your
              device as a single HTML file, so there is no build step and nothing to host.
            </p>
          </div>
        </header>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'generation'}
            className={`${styles.tab} ${activeTab === 'generation' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('generation')}
          >
            Generation
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'past'}
            className={`${styles.tab} ${activeTab === 'past' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('past')}
          >
            Past Editions
          </button>
        </div>

        {activeTab === 'generation' ? (
          <>
            <main className={styles.main}>
              <div className={styles.step}>
                <div className={styles.stepRail}>
                  <span className={styles.stepNumber}>1</span>
                  <span className={styles.stepLine} aria-hidden="true" />
                </div>
                <div className={styles.stepContent}>
                  <DropZone file={file} onFileSelect={setFile} />
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepRail}>
                  <span className={styles.stepNumber}>2</span>
                </div>
                <div className={styles.stepContent}>
                  <FormatPicker selectedFormat={selectedFormat} onSelect={setSelectedFormat} />
                </div>
              </div>
            </main>

            <div className={styles.actions}>
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
          </>
        ) : (
          <PastEditions />
        )}

        <footer className={styles.footer}>Developed by Lavanya Kamble</footer>
      </div>
    </div>
  )
}
