export default function MeetingNotesCover() {
  return (
    <svg viewBox="0 0 240 140" className="cover-svg" aria-hidden="true">
      <rect width="240" height="140" fill="#eef1f6" />
      <circle cx="28" cy="32" r="10" fill="#94a3b8" />
      <circle cx="42" cy="32" r="10" fill="#cbd5e1" />
      <circle cx="56" cy="32" r="10" fill="#2b5be0" />
      {[58, 76, 94, 112].map((y, i) => (
        <rect
          key={y}
          x="24"
          y={y}
          width={i === 2 ? 130 : 192}
          height="6"
          rx="3"
          fill="#cbd5e1"
        />
      ))}
    </svg>
  )
}
