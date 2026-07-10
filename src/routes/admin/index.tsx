import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  beforeLoad: () => {
    // Sign-in lives at /login now; the admin landing is the poll list
    // (which redirects unauthenticated visitors to /login itself).
    throw redirect({ to: '/admin/polls' })
  },
})
