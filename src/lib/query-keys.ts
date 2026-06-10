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
}
