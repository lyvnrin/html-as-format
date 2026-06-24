export default function ResearchBriefCover() {
  const blocks = [
    [24, 20], [86, 20], [148, 20],
    [24, 56], [86, 56], [148, 56],
    [24, 92], [86, 92], [148, 92],
  ]
  return (
    <svg viewBox="0 0 240 140" className="cover-svg" aria-hidden="true">
      <rect width="240" height="140" fill="#eef1f6" />
      {blocks.map(([x, y], i) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="56" height="28" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
          <rect x={x + 8} y={y + 8} width={i % 3 === 1 ? 28 : 36} height="5" rx="2.5" fill="#94a3b8" />
          <rect x={x + 8} y={y + 17} width="24" height="5" rx="2.5" fill="#cbd5e1" />
        </g>
      ))}
    </svg>
  )
}
