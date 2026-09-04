/** Фон как на странице входа: тёмный градиент + лёгкая сетка. */
export function AuthBackdrop({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 55% at 15% 10%, oklch(0.78 0.08 55 / 0.35), transparent 55%),
            radial-gradient(ellipse 55% 45% at 90% 85%, oklch(0.75 0.05 230 / 0.35), transparent 50%),
            linear-gradient(160deg, oklch(0.28 0.03 250), oklch(0.22 0.025 250) 45%, oklch(0.2 0.02 250))
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(oklch(1 0 0 / 0.4) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  )
}
