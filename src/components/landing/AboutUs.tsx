const families = [
  'Familie Hinkel schafft den organisatorischen Rahmen und haltet den gemeinsamen Gartenkalender aktuell.',
  'Familie Kirschenhofer bringt Beetplanung, Ernteideen und den sportlichen Teil der Treffen zusammen.',
] as const

function AboutUs() {
  return (
    <section
      className="grid gap-6 rounded-[2rem] bg-white/75 p-6 shadow-[0_24px_50px_rgba(31,61,43,0.1)] backdrop-blur sm:p-8 lg:grid-cols-[1.1fr_0.9fr]"
      id="ueber-uns"
    >
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-forest-700">
          Uber uns
        </p>
        <h2 className="max-w-[14ch] text-4xl text-forest-900 sm:text-5xl">
          Zwei Familien, ein Garten und ein klarer gemeinsamer Takt.
        </h2>
        <p className="max-w-[58ch] text-base text-forest-700/80 sm:text-lg">
          SV Beet & Bewegung verbindet Gartenarbeit, spontane Treffen und die
          Abstimmung von Terminen. Die Seite wird Schritt fur Schritt zur
          gemeinsamen Anlaufstelle fur Planung, Zusagen und finale Termine.
        </p>
      </div>

      <div className="grid gap-4">
        {families.map((family) => (
          <article
            className="rounded-[1.75rem] bg-cream-50/90 p-5 text-sm leading-7 text-forest-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:text-base"
            key={family}
          >
            {family}
          </article>
        ))}
      </div>
    </section>
  )
}

export default AboutUs
