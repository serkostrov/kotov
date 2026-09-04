export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      {/* ears */}
      <path d="M7.5 14.5 10.2 4.8 15.2 12.8Z" fill="#1A2332" />
      <path d="M24.5 14.5 21.8 4.8 16.8 12.8Z" fill="#1A2332" />
      {/* head */}
      <ellipse cx="16" cy="18.2" rx="9" ry="8.4" fill="#1A2332" />
      {/* eyes */}
      <ellipse cx="12.6" cy="17.2" rx="1.55" ry="1.8" fill="currentColor" />
      <ellipse cx="19.4" cy="17.2" rx="1.55" ry="1.8" fill="currentColor" />
      {/* pupils */}
      <ellipse cx="12.6" cy="17.45" rx="0.55" ry="0.95" fill="#1A2332" />
      <ellipse cx="19.4" cy="17.45" rx="0.55" ry="0.95" fill="#1A2332" />
      {/* nose */}
      <path d="M16 19.1 14.55 21.15h2.9Z" fill="currentColor" />
      {/* mouth */}
      <path
        d="M16 21.1v1.1M16 22.2c-1.1.05-2-.55-2.35-1.15M16 22.2c1.1.05 2-.55 2.35-1.15"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* whiskers */}
      <path
        d="M6.8 18.4h3.4M6.5 20.2h3.5M25.2 18.4h-3.4M25.5 20.2h-3.5"
        stroke="currentColor"
        strokeWidth="0.85"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}
