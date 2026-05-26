import AboutUs from '~/components/landing/AboutUs'
import ActivePollTeaser from '~/components/landing/ActivePollTeaser'
import Footer from '~/components/landing/Footer'
import Hero from '~/components/landing/Hero'
import Navbar from '~/components/landing/Navbar'
import WavyDivider from '~/components/landing/WavyDivider'
import WhatWeDo from '~/components/landing/WhatWeDo'

function App() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(122,181,46,0.2),transparent_32%),linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-forest-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <Navbar />
        <main className="flex-1 space-y-10 pb-16">
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
