export default function BubbleMapCover() {
  const backBubbles = [
    { x: 120, y: 55, r: 32, fill: 'var(--accent)' },
    { x: 174, y: 88, r: 27, fill: 'var(--accent-light)' },
  ]
  const frontBubbles = [
    { x: 88, y: 103, r: 22, fill: 'var(--muted)' },
    { x: 77, y: 23, r: 18, fill: 'var(--gold-light)' },
    { x: 128, y: 112, r: 10, fill: 'var(--accent)' },
  ]
  return (
    <svg viewBox="0 0 240 140" className="cover-svg" aria-hidden="true">
      {/* Layered for mouse-tracked parallax — see TimelineCover.jsx note. */}
      <g className="cover-layer-back">
        <rect width="240" height="140" style={{ fill: 'var(--paper-shade)' }} />
      </g>
      <g className="cover-layer-mid">
        {backBubbles.map((b) => (
          <circle key={`${b.x}-${b.y}`} cx={b.x} cy={b.y} r={b.r} style={{ fill: b.fill }} />
        ))}
      </g>
      <g className="cover-layer-front">
        {frontBubbles.map((b) => (
          <circle key={`${b.x}-${b.y}`} cx={b.x} cy={b.y} r={b.r} style={{ fill: b.fill }} />
        ))}
      </g>
    </svg>
  )
}
