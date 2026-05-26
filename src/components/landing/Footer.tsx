function Footer() {
  return (
    <footer className="rounded-[2rem] bg-white/65 px-6 py-6 shadow-[0_20px_40px_rgba(31,61,43,0.08)] backdrop-blur sm:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <img
            alt="Logo von SV Beet & Bewegung"
            className="h-14 w-auto rounded-full bg-cream-50/60 p-1"
            src="/logo.png"
          />
          <div>
            <p className="font-display text-xl text-forest-900">
              SV Beet & Bewegung
            </p>
            <p className="text-sm text-forest-700/80">
              Gartenplanung, Familienkalender und Doodle in einer gemeinsamen
              Oberflache.
            </p>
          </div>
        </div>

        <p className="text-sm text-forest-700/70">
          Cloudflare Pages, React und ein bewusst schlichtes Setup bilden die
          Grundlage.
        </p>
      </div>
    </footer>
  )
}

export default Footer
