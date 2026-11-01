import { LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { displayName, initials, useAuth } from '../lib/auth'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu"
        className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-bold text-white ring-2 ring-transparent hover:ring-brand/40">
        {initials(user)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-md border border-line-2 bg-panel shadow-2xl shadow-black/60">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate font-semibold">{displayName(user)}</p>
            <p className="truncate text-sm text-fg-2">{user?.email}</p>
            {user?.created_at && <p className="mt-1 text-xs text-fg-3">Member since {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>}
          </div>
          <button role="menuitem" onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-fg-2 hover:bg-raised hover:text-fg">
            <LogOut className="h-4 w-4" aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  )
}
