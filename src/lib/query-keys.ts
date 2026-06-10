export const queryKeys = {
  polls: {
    all: ['polls'] as const,
    active: ['polls', 'active'] as const,
    next: ['polls', 'next'] as const,
    detail: (pollId: string) => ['polls', 'detail', pollId] as const,
    admin: ['polls', 'admin'] as const,
  },
}
