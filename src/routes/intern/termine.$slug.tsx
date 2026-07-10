import { createFileRoute } from '@tanstack/react-router'
import EventDetailPage from '~/components/intern/EventDetailPage'

export const Route = createFileRoute('/intern/termine/$slug')({
  component: EventDetailRoute,
})

function EventDetailRoute() {
  const { slug } = Route.useParams()
  return <EventDetailPage eventSlug={slug} />
}
