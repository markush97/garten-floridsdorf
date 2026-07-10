import { createFileRoute } from '@tanstack/react-router'
import LoginPage from '~/components/auth/LoginPage'

type LoginSearch = {
  magic?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    magic: typeof search.magic === 'string' ? search.magic : undefined,
  }),
  component: LoginRoute,
})

function LoginRoute() {
  const { magic } = Route.useSearch()
  return <LoginPage magicError={magic === 'invalid'} />
}
