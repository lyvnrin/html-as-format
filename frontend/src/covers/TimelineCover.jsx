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
        <rect width="240" height="140" fill="#eef1f6" />
      </g>
      <g className="cover-layer-mid">
        <line x1="120" y1="12" x2="120" y2="130" stroke="#94a3b8" strokeWidth="2" />
        {nodes.map((n) => (
          <circle key={n.y} cx="120" cy={n.y} r="7" fill="#ffffff" stroke="#2b5be0" strokeWidth="3" />
        ))}
      </g>
      <g className="cover-layer-front">
        {nodes.map((n, i) => {
          const barX = n.side === 'right' ? 140 : 40
          return (
            <g key={n.y}>
              <rect x={barX} y={n.y - 3} width="60" height="6" rx="3" fill="#cbd5e1" />
              {i === 1 && <rect x={barX} y={n.y + 6} width="42" height="5" rx="2.5" fill="#94a3b8" />}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
