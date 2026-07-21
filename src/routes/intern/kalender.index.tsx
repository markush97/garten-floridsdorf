import { createFileRoute } from '@tanstack/react-router'
import KalenderPage from '~/components/intern/KalenderPage'

export const Route = createFileRoute('/intern/kalender/')({
  component: KalenderPage,
})
