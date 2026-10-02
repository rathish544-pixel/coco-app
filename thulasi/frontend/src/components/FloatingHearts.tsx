import { useMemo } from 'react'

interface FloatingHeartsProps {
  count?: number
}

/** Slow drifting hearts behind the content. Purely decorative. */
export function FloatingHearts({ count = 12 }: FloatingHeartsProps) {
  const hearts = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        left: `${(index * 37) % 96}%`,
        delay: `${(index * 0.9) % 7}s`,
        duration: `${6 + (index % 5)}s`,
        size: 10 + ((index * 7) % 16),
        opacity: 0.16 + ((index % 4) * 0.07),
      })),
    [count],
  )

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {hearts.map((heart) => (
        <span
          key={heart.id}
          className="animate-float-up absolute bottom-[-10vh] select-none text-blush"
          style={{
            left: heart.left,
            animationDelay: heart.delay,
            animationDuration: heart.duration,
            fontSize: `${heart.size}px`,
            opacity: heart.opacity,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  )
}
