export default function GenericCover() {
  return (
    <svg viewBox="0 0 240 140" className="cover-svg" aria-hidden="true">
      <g className="cover-layer-back">
        <rect width="240" height="140" style={{ fill: 'var(--paper-shade)' }} />
      </g>
      <g className="cover-layer-mid">
        <rect x="60" y="30" width="120" height="14" rx="4" style={{ fill: 'var(--accent-light)' }} />
        <rect x="60" y="58" width="120" height="8" rx="4" style={{ fill: 'var(--muted)' }} />
        <rect x="60" y="76" width="90" height="8" rx="4" style={{ fill: 'var(--muted)' }} />
      </g>
      <g className="cover-layer-front">
        <circle cx="120" cy="108" r="6" style={{ fill: 'var(--paper)', stroke: 'var(--accent)' }} strokeWidth="3" />
      </g>
    </svg>
  )
}
