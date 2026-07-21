import { Logout01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { cn } from '~/lib/ui-utils'
import { useLogout } from '~/services/auth.service'
import { Button } from '~/ui/button'
import type { SessionUser } from '~func/contracts/auth'

type MemberShellProps = {
  me: SessionUser
  children: React.ReactNode
}

type MemberNavItem = {
  to: '/intern' | '/intern/termine' | '/intern/kassa' | '/intern/aufgaben'
  label: string
}

const MEMBER_NAV_ITEMS: readonly MemberNavItem[] = [
  { to: '/intern', label: 'Dokumente' },
  { to: '/intern/termine', label: 'Termine' },
  { to: '/intern/aufgaben', label: 'Aufgaben' },
  { to: '/intern/kassa', label: 'Kassa' },
] as const

/** Page chrome for the members-only area ("Interner Bereich"). */
function MemberShell({ me, children }: MemberShellProps) {
  const navigate = useNavigate()
  const { mutate: logout, isPending: isLoggingOut } = useLogout()
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
          <span className="text-sm font-medium text-forest-700">
            Interner Bereich
          </span>
        </div>
        <nav
          aria-label="Interne Bereiche"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {MEMBER_NAV_ITEMS.map((item) => {
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
        <div className="flex items-center gap-2">
          {me.role === 'admin' && (
            <Link
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-forest-700/80 transition hover:bg-cream-50/80 hover:text-forest-900 sm:px-4"
              to="/admin/polls"
            >
              Admin
            </Link>
          )}
          <span className="hidden text-xs text-forest-700/60 sm:inline">
            {me.name}
          </span>
          <Button
            aria-label="Abmelden"
            disabled={isLoggingOut}
            onClick={() =>
              logout(undefined, {
                onSuccess: () => void navigate({ to: '/' }),
              })
            }
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={Logout01Icon}
              size={14}
              strokeWidth={1.6}
            />
            Abmelden
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-3 pb-20 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}

export default MemberShell
