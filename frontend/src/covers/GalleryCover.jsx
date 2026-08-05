export default function GalleryCover() {
  return (
    <svg viewBox="0 0 240 140" className="cover-svg" aria-hidden="true">
      {/* Layered for mouse-tracked parallax — see TimelineCover.jsx note. */}
      <g className="cover-layer-back">
        <rect width="240" height="140" style={{ fill: 'var(--paper-shade)' }} />
      </g>
      <g className="cover-layer-mid">
        <rect x="16" y="14" width="66" height="48" rx="4" style={{ fill: 'var(--accent)' }} />
        <rect x="16" y="66" width="66" height="26" rx="4" style={{ fill: 'var(--accent-light)' }} />
        <rect x="90" y="14" width="66" height="26" rx="4" style={{ fill: 'var(--accent-light)' }} />
        <rect x="164" y="14" width="60" height="70" rx="4" style={{ fill: 'var(--gold-light)' }} />
      </g>
      <g className="cover-layer-front">
        <rect x="90" y="44" width="66" height="48" rx="4" style={{ fill: 'var(--muted)' }} />
        <rect x="16" y="100" width="66" height="26" rx="4" style={{ fill: 'var(--accent-light)' }} />
        <rect x="90" y="100" width="66" height="26" rx="4" style={{ fill: 'var(--accent)' }} />
        <rect x="164" y="92" width="60" height="34" rx="4" style={{ fill: 'var(--accent-light)' }} />
      </g>
    </svg>
  )
}
