import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '~/lib/ui-utils'

type AdminNavItem = {
  to: '/admin/polls' | '/admin/users' | '/admin/events'
  label: string
}

const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { to: '/admin/polls', label: 'Umfragen' },
  { to: '/admin/events', label: 'Termine' },
  { to: '/admin/users', label: 'Benutzer' },
] as const

type AdminShellProps = {
  children: React.ReactNode
}

function AdminShell({ children }: AdminShellProps) {
  const currentPath = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-forest-900">
      <header className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-3 px-3 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link to="/">
            <img
              alt="SV Beet & Bewegung"
              className="h-9 w-9 mix-blend-multiply"
              src="/brand/icon.png"
            />
          </Link>
          <span className="text-sm font-medium text-forest-700">Admin</span>
        </div>
        <nav
          aria-label="Admin-Bereiche"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.to
            return (
              <Link
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold transition sm:px-4',
                  isActive
                    ? 'bg-forest-900/8 text-forest-900'
                    : 'text-forest-700/80 hover:bg-cream-50/80 hover:text-forest-900',
                )}
                key={item.to}
                to={item.to}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <Link className="text-xs text-forest-700/60 underline" to="/">
          Zur Startseite
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-3 pb-20 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}

export default AdminShell
