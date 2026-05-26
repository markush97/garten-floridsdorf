const items = [
  {
    title: 'Beet',
    text: 'Aussaat, Pflege und gemeinsame Arbeitstage sollen kuftig direkt aus einer aktiven Umfrage entstehen.',
  },
  {
    title: 'Ernte',
    text: 'Sobald Termine feststehen, kann der finale Tag fur Ernte, Jause oder Grillrunde markiert werden.',
  },
  {
    title: 'Bewegung',
    text: 'Auch Spaziergaenge, Gartenrunden und spontane Familienaktionen passen in denselben Ablauf.',
  },
] as const

function WhatWeDo() {
  return (
    <section className="space-y-5" id="was-wir-tun">
      <div className="space-y-3 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-forest-700">
          Was wir tun
        </p>
        <h2 className="max-w-[15ch] text-4xl text-forest-900 sm:text-5xl">
          Drei Themenfelder, ein gemeinsamer Ablauf.
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {items.map((item) => (
          <article
            className="rounded-[2rem] bg-white/70 p-6 shadow-[0_22px_45px_rgba(31,61,43,0.08)] backdrop-blur transition hover:-translate-y-1"
            key={item.title}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-beet-700">
              Bereich
            </p>
            <h3 className="mt-3 font-display text-3xl text-forest-900">
              {item.title}
            </h3>
            <p className="mt-3 text-base leading-7 text-forest-700/80">
              {item.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default WhatWeDo
