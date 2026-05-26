import { cn } from '~/lib/ui-utils'

const navigationItems = [
  { href: '#ueber-uns', label: 'Uber uns' },
  { href: '#was-wir-tun', label: 'Was wir tun' },
  { href: '#aktuelle-umfrage', label: 'Aktuelle Umfrage' },
] as const

function Navbar() {
  return (
    <header className="sticky top-4 z-10 rounded-[1.75rem] bg-white/72 px-4 py-3 shadow-[0_18px_40px_rgba(31,61,43,0.08)] backdrop-blur sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <img
            alt="Icon von SV Beet & Bewegung"
            className="h-12 w-12 rounded-full bg-cream-50 p-1"
            src="/icon.png"
          />
          <div>
            <p className="font-display text-2xl text-forest-900">
              SV Beet & Bewegung
            </p>
            <p className="text-sm text-forest-700/75">
              Floridsdorf, Garten und gemeinsame Termine
            </p>
          </div>
        </div>

        <nav aria-label="Hauptnavigation" className="flex flex-wrap gap-2">
          {navigationItems.map((item) => (
            <a
              className={cn(
                'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition',
                'text-forest-700 hover:bg-cream-50/80 hover:text-forest-900',
              )}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

export default Navbar
