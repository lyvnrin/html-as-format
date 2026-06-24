export default function BubbleMapCover() {
  const satellites = [
    { x: 56, y: 36, r: 14 },
    { x: 188, y: 32, r: 11 },
    { x: 198, y: 96, r: 13 },
    { x: 52, y: 104, r: 10 },
  ]
  return (
    <svg viewBox="0 0 240 140" className="cover-svg" aria-hidden="true">
      <rect width="240" height="140" fill="#eef1f6" />
      {satellites.map((s) => (
        <line
          key={`${s.x}-${s.y}`}
          x1="120"
          y1="70"
          x2={s.x}
          y2={s.y}
          stroke="#cbd5e1"
          strokeWidth="2"
        />
      ))}
      {satellites.map((s) => (
        <circle key={`c-${s.x}-${s.y}`} cx={s.x} cy={s.y} r={s.r} fill="#94a3b8" />
      ))}
      <circle cx="120" cy="70" r="26" fill="#2b5be0" />
    </svg>
  )
}
