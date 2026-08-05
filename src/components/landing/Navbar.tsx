import { Link } from '@tanstack/react-router'
import { cn } from '~/lib/ui-utils'

const navigationItems = [
  { href: '#ueber-uns', label: 'Über uns' },
  { href: '#was-wir-tun', label: 'Was wir tun' },
  { href: '#naechster-termin', label: 'Nächster Termin' },
  { href: '#aktuelle-umfrage', label: 'Aktuelle Terminabstimmung' },
] as const

function Navbar() {
  return (
    <header className="sticky top-3 z-10 rounded-[1.25rem] bg-white/72 px-3 py-2.5 shadow-[0_14px_32px_rgba(31,61,43,0.08)] ring-1 ring-inset ring-white/40 backdrop-blur-md sm:top-4 sm:rounded-[1.75rem] sm:px-6 sm:py-3 sm:shadow-[0_18px_40px_rgba(31,61,43,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <a className="group flex min-w-0 items-center gap-3" href="#top">
          <img
            alt="Icon von Bewegung im Grünen"
            className="h-10 w-10 shrink-0 mix-blend-multiply transition duration-500 group-hover:rotate-[8deg] group-hover:scale-105 sm:h-12 sm:w-12"
            src="/brand/icon.png"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-xl text-forest-900 sm:text-2xl">
              Bewegung im Grünen
            </p>
            <p className="hidden text-sm text-forest-700/75 sm:block">
              Jedlesee, Garten und gemeinsame Termine
            </p>
          </div>
        </a>

        <nav
          aria-label="Hauptnavigation"
          className="hidden shrink-0 gap-1 lg:flex"
        >
          {navigationItems.map((item) => (
            <a
              className={cn(
                'group relative inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-3 text-sm font-semibold transition sm:px-4',
                'text-forest-700 hover:bg-cream-50/80 hover:text-forest-900',
              )}
              href={item.href}
              key={item.href}
            >
              <span className="relative">
                {item.label}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 h-[2px] w-full origin-left scale-x-0 rounded-full bg-leaf-500 transition-transform duration-300 group-hover:scale-x-100"
                />
              </span>
            </a>
          ))}
        </nav>

        <Link
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-3 text-sm font-semibold text-forest-700 transition hover:bg-cream-50/80 hover:text-forest-900 sm:px-4 lg:ml-2"
          to="/login"
        >
          Login
        </Link>
      </div>
    </header>
  )
}

export default Navbar
