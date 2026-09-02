export default function IPSaktiLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="3" fill="#7fd9ae" style={{ filter: 'drop-shadow(0 0 6px #7fd9ae)' }} />
      <path
        d="M10 13 L10 20 M10 7 L4 2 M10 7 L16 2 M6.5 8.5 L1 8 M13.5 8.5 L19 8"
        stroke="#4f8f70" strokeWidth="1.1" fill="none" strokeLinecap="round"
      />
    </svg>
  )
}
