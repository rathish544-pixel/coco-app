import { NavLink } from 'react-router-dom'
import { Camera, Heart, Images, Mail, Music } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const items: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/', label: 'Us', Icon: Heart },
  { to: '/memories', label: 'Memories', Icon: Images },
  { to: '/photos', label: 'Photos', Icon: Camera },
  { to: '/songs', label: 'Songs', Icon: Music },
  { to: '/notes', label: 'Notes', Icon: Mail },
]

export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3 pb-2">
      <div className="glass mx-auto flex max-w-md items-center justify-around rounded-3xl px-1.5 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[10px] transition',
                isActive ? 'text-rose' : 'text-faint hover:text-mist',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                <span className={isActive ? 'font-medium' : ''}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
