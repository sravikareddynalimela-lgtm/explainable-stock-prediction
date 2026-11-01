export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#3D8BFF" />
        <rect x="7" y="13" width="3.4" height="10" rx="1" fill="#fff" />
        <rect x="14.3" y="8" width="3.4" height="12" rx="1" fill="#fff" />
        <rect x="21.6" y="11" width="3.4" height="7" rx="1" fill="#fff" opacity=".6" />
      </svg>
      <span className={`text-lg font-bold tracking-tight ${compact ? 'hidden sm:inline' : ''}`}>Clearview</span>
    </span>
  )
}
