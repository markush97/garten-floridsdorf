import { createFileRoute } from '@tanstack/react-router'
import TasksPage from '~/components/intern/TasksPage'

export const Route = createFileRoute('/intern/aufgaben/')({
  component: TasksPage,
})
