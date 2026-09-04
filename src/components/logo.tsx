export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="currentColor" className="text-sidebar-primary" />
      <path
        d="M7.5 8h5l4.8 7.4L22.2 8H27L20.2 18.2 27 28h-4.8l-4.9-7.5L12.5 28H7.5l6.8-9.8L7.5 8z"
        fill="#1A2332"
      />
    </svg>
  )
}
