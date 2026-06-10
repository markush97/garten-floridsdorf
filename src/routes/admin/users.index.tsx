import { createFileRoute } from '@tanstack/react-router'
import AdminUsersList from '~/components/admin/AdminUsersList'

export const Route = createFileRoute('/admin/users/')({
  component: AdminUsersPage,
})

function AdminUsersPage() {
  return <AdminUsersList />
}
