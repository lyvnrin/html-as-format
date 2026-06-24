export default function TimelineCover() {
  return (
    <svg viewBox="0 0 240 140" className="cover-svg" aria-hidden="true">
      <rect width="240" height="140" fill="#eef1f6" />
      <line x1="24" y1="62" x2="216" y2="62" stroke="#94a3b8" strokeWidth="2" />
      {[24, 80, 136, 192].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="62" r="7" fill="#ffffff" stroke="#2b5be0" strokeWidth="3" />
          <rect x={x - 16} y="84" width="32" height="6" rx="3" fill="#cbd5e1" />
          {i === 1 && <rect x={x - 12} y="96" width="24" height="5" rx="2.5" fill="#94a3b8" />}
        </g>
      ))}
    </svg>
  )
}
