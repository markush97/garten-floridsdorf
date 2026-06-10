import { createFileRoute } from '@tanstack/react-router'
import EventEditor from '~/components/admin/EventEditor'

export const Route = createFileRoute('/admin/events/$slug')({
  component: EventEditorPage,
})

function EventEditorPage() {
  const { slug } = Route.useParams()
  return <EventEditor eventSlug={slug} />
}
