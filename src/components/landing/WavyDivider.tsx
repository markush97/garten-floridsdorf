function WavyDivider() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[1.75rem] bg-white/35 px-2 py-4"
    >
      <svg
        className="h-16 w-full text-forest-700/55"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 1200 120"
      >
        <title>Wellen-Trenner</title>
        <path
          d="M0 52C85 16 170 16 255 52C340 88 425 88 510 52C595 16 680 16 765 52C850 88 935 88 1020 52C1080 26 1140 20 1200 34V120H0Z"
          fill="currentColor"
          opacity="0.35"
        />
        <path
          d="M0 30C75 66 150 66 225 30C300 -6 375 -6 450 30C525 66 600 66 675 30C750 -6 825 -6 900 30C975 66 1050 66 1125 30C1150 18 1175 12 1200 10"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default WavyDivider
