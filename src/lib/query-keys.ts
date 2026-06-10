export const queryKeys = {
  polls: {
    all: ['polls'] as const,
    active: ['polls', 'active'] as const,
    next: ['polls', 'next'] as const,
    detail: (pollId: string) => ['polls', 'detail', pollId] as const,
    admin: ['polls', 'admin'] as const,
  },
  users: {
    all: ['users'] as const,
    admin: ['users', 'admin'] as const,
    detail: (slug: string) => ['users', 'detail', slug] as const,
  },
  events: {
    all: ['events'] as const,
    admin: ['events', 'admin'] as const,
    detail: (slug: string) => ['events', 'detail', slug] as const,
    forPoll: (pollId: number) => ['events', 'for-poll', pollId] as const,
  },
}
