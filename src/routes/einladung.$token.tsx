import { createFileRoute } from '@tanstack/react-router'
import InvitePage from '~/components/auth/InvitePage'

export const Route = createFileRoute('/einladung/$token')({
  component: InviteRoute,
})

function InviteRoute() {
  const { token } = Route.useParams()
  return <InvitePage token={token} />
}
