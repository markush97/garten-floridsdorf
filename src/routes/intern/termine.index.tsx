import { createFileRoute } from '@tanstack/react-router'
import EventsPage from '~/components/intern/EventsPage'

export const Route = createFileRoute('/intern/termine/')({
  component: EventsPage,
})
