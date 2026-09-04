export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      {/* Monogram К — геометрическая литера */}
      <path
        d="M11 7.5h3.4v6.85L21.55 7.5H26L18.15 15.8 26 24.5h-4.45L14.4 17.35V24.5H11V7.5Z"
        fill="#1A2332"
      />
    </svg>
  )
}
