import { createFileRoute } from '@tanstack/react-router'
import KassaPage from '~/components/intern/KassaPage'

export const Route = createFileRoute('/intern/kassa/')({
  component: KassaPage,
})
