import { createFileRoute } from '@tanstack/react-router'
import PollEditor from '~/components/admin/PollEditor'

export const Route = createFileRoute('/admin/polls/$id')({
  component: PollEditorPage,
})

function PollEditorPage() {
  const { id } = Route.useParams()
  return <PollEditor pollId={id} />
}
