import { createFileRoute } from '@tanstack/react-router'
import PollPage from '~/components/poll/PollPage'

export const Route = createFileRoute('/abstimmung/$slug/$token')({
  component: PollRoute,
})

function PollRoute() {
  const { slug, token } = Route.useParams()
  return <PollPage slug={slug} token={token} />
}
