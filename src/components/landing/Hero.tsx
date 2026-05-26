import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] bg-forest-900 text-cream-50 shadow-[0_32px_70px_rgba(31,61,43,0.24)]">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url('/banner.png')` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(31,61,43,0.92),rgba(122,31,61,0.72))]" />

      <div className="relative grid gap-8 px-6 py-10 sm:px-8 sm:py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-12 lg:py-16">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-leaf-500">
            Familiengarten Wien
          </p>
          <h1 className="max-w-[12ch] text-5xl text-cream-50 sm:text-6xl lg:text-7xl">
            Familiengarten, Termine und Abstimmungen an einem Ort.
          </h1>
          <p className="max-w-[58ch] text-base text-cream-50/85 sm:text-lg lg:text-xl">
            Gemeinsam gärtnern, Termine abstimmen und Erntemomente festhalten –
            für Familien Kirschenhofer und Hinkel.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cream-50 px-6 text-sm font-semibold text-forest-900 shadow-[0_12px_30px_rgba(245,240,225,0.18)] sm:text-base"
              href="#aktuelle-umfrage"
            >
              Zur aktuellen Umfrage
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
            </a>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/12 px-6 text-sm font-semibold text-cream-50 ring-1 ring-inset ring-white/18 backdrop-blur sm:text-base"
              href="#was-wir-tun"
            >
              Bereiche ansehen
            </a>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white/12 p-5 backdrop-blur sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-leaf-500">
            Wer wir sind
          </p>
          <dl className="mt-5 grid gap-4 text-sm text-cream-50/80 sm:text-base">
            <div>
              <dt className="font-semibold text-cream-50">Familie Hinkel</dt>
              <dd>
                Koordiniert den Gartenkalender und sorgt dafür, dass Termine
                rechtzeitig zur Abstimmung stehen.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-cream-50">
                Familie Kirschenhofer
              </dt>
              <dd>
                Bringt Beetplanung, Ernteideen und den sportlichen Schwung in
                die gemeinsamen Treffen.
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}

export default Hero
