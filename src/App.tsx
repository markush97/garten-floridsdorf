import AboutUs from '~/components/landing/AboutUs'
import ActivePollTeaser from '~/components/landing/ActivePollTeaser'
import Footer from '~/components/landing/Footer'
import Hero from '~/components/landing/Hero'
import IntroLeaves from '~/components/landing/IntroLeaves'
import Navbar from '~/components/landing/Navbar'
import WavyDivider from '~/components/landing/WavyDivider'
import WhatWeDo from '~/components/landing/WhatWeDo'

function App() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(122,181,46,0.22),transparent_32%),linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-forest-900"
      id="top"
    >
      <IntroLeaves />
      <div
        aria-hidden="true"
        className="paper-texture pointer-events-none absolute inset-0 opacity-60"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-3 pb-6 pt-3 sm:px-6 sm:pb-8 sm:pt-4 lg:px-8">
        <Navbar />
        <main className="flex-1 space-y-12 pb-14 pt-4 sm:space-y-16 sm:pb-20 sm:pt-6 lg:space-y-20">
          <Hero />
          <WavyDivider />
          <AboutUs />
          <WhatWeDo />
          <ActivePollTeaser />
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default App
