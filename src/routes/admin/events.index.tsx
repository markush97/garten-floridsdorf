import { createFileRoute } from '@tanstack/react-router'
import AdminEventsList from '~/components/admin/AdminEventsList'

export const Route = createFileRoute('/admin/events/')({
  component: AdminEventsPage,
})

function AdminEventsPage() {
  return <AdminEventsList />
}
