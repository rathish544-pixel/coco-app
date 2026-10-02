import { useMemo } from 'react'

/** Hearts that fly outward from the centre — the payoff after sending. */
export function HeartBurst({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2
        const distance = 90 + ((index * 29) % 110)
        return {
          id: index,
          dx: `${Math.cos(angle) * distance}px`,
          dy: `${Math.sin(angle) * distance}px`,
          spin: `${(index % 2 ? 1 : -1) * (30 + index * 6)}deg`,
          delay: `${(index % 5) * 0.06}s`,
          size: index % 3 === 0 ? 'text-2xl' : 'text-lg',
        }
      }),
    [],
  )

  if (!active) return null

  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={`animate-burst absolute text-blush ${piece.size}`}
          style={
            {
              '--dx': piece.dx,
              '--dy': piece.dy,
              '--spin': piece.spin,
              animationDelay: piece.delay,
            } as React.CSSProperties
          }
        >
          ♥
        </span>
      ))}
    </div>
  )
}
