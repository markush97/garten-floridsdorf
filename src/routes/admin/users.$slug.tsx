import { createFileRoute } from '@tanstack/react-router'
import UserEditor from '~/components/admin/UserEditor'

export const Route = createFileRoute('/admin/users/$slug')({
  component: UserEditorPage,
})

function UserEditorPage() {
  const { slug } = Route.useParams()
  return <UserEditor userSlug={slug} />
}
