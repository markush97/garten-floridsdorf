import { cn } from '~/lib/ui-utils'

const navigationItems = [
  { href: '#ueber-uns', label: 'Über uns' },
  { href: '#was-wir-tun', label: 'Was wir tun' },
  { href: '#aktuelle-umfrage', label: 'Aktuelle Umfrage' },
] as const

function Navbar() {
  return (
    <header className="sticky top-3 z-10 rounded-[1.25rem] bg-white/72 px-3 py-2.5 shadow-[0_14px_32px_rgba(31,61,43,0.08)] ring-1 ring-inset ring-white/40 backdrop-blur-md sm:top-4 sm:rounded-[1.75rem] sm:px-6 sm:py-3 sm:shadow-[0_18px_40px_rgba(31,61,43,0.08)]">
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <a className="group flex items-center gap-3" href="#top">
          <img
            alt="Icon von SV Beet & Bewegung"
            className="h-10 w-10 rounded-full bg-cream-50 p-1 transition duration-500 group-hover:rotate-[8deg] group-hover:scale-105 sm:h-12 sm:w-12"
            src="/brand/icon.png"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-xl text-forest-900 sm:text-2xl">
              SV Beet & Bewegung
            </p>
            <p className="hidden text-sm text-forest-700/75 sm:block">
              Floridsdorf, Garten und gemeinsame Termine
            </p>
          </div>
        </a>

        <nav
          aria-label="Hauptnavigation"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      </div>
    </header>
  )
}

export default Navbar
