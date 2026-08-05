export default function TimelineCover() {
  const nodes = [
    { y: 20, side: 'right' },
    { y: 54, side: 'left' },
    { y: 88, side: 'right' },
    { y: 122, side: 'left' },
  ]
  return (
    <svg viewBox="0 0 240 140" className="cover-svg" aria-hidden="true">
      {/* Layered for mouse-tracked parallax (FormatCard.jsx sets
          --parallax-x/--parallax-y; see FormatCard.module.css). Same
          elements/colours as before, just grouped by depth. */}
      <g className="cover-layer-back">
        <rect width="240" height="140" style={{ fill: 'var(--paper-shade)' }} />
      </g>
      <g className="cover-layer-mid">
        <line x1="120" y1="12" x2="120" y2="130" style={{ stroke: 'var(--muted)' }} strokeWidth="2" />
        {nodes.map((n) => (
          <circle
            key={n.y}
            cx="120"
            cy={n.y}
            r="7"
            style={{ fill: 'var(--paper)', stroke: 'var(--accent)' }}
            strokeWidth="3"
          />
        ))}
      </g>
      <g className="cover-layer-front">
        {nodes.map((n, i) => {
          const barX = n.side === 'right' ? 140 : 40
          return (
            <g key={n.y}>
              <rect x={barX} y={n.y - 3} width="60" height="6" rx="3" style={{ fill: 'var(--accent-light)' }} />
              {i === 1 && (
                <rect x={barX} y={n.y + 6} width="42" height="5" rx="2.5" style={{ fill: 'var(--muted)' }} />
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
