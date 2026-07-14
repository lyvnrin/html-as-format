export default function BubbleMapCover() {
  const bubbles = [
    { x: 120, y: 55, r: 32, fill: '#2b5be0' },
    { x: 174, y: 88, r: 27, fill: '#cbd5e1' },
    { x: 88, y: 103, r: 22, fill: '#94a3b8' },
    { x: 77, y: 23, r: 18, fill: '#a5b4fc' },
    { x: 128, y: 112, r: 10, fill: '#2b5be0' },
  ]
  return (
    <svg viewBox="0 0 240 140" className="cover-svg" aria-hidden="true">
      <rect width="240" height="140" fill="#eef1f6" />
      {bubbles.map((b) => (
        <circle key={`${b.x}-${b.y}`} cx={b.x} cy={b.y} r={b.r} fill={b.fill} />
      ))}
    </svg>
  )
}
