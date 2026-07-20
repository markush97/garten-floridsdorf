export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
    invite: (token: string) => ['auth', 'invite', token] as const,
  },
  documents: {
    all: ['documents'] as const,
    browse: (folderId: number | null) =>
      ['documents', 'browse', folderId] as const,
    folders: ['documents', 'folders'] as const,
    shareTokens: (documentId: number) =>
      ['documents', documentId, 'share-tokens'] as const,
    folderShareTokens: (folderId: number) =>
      ['documents', 'folders', folderId, 'share-tokens'] as const,
  },
  polls: {
    all: ['polls'] as const,
    active: ['polls', 'active'] as const,
    next: ['polls', 'next'] as const,
    detail: (pollId: string) => ['polls', 'detail', pollId] as const,
    admin: ['polls', 'admin'] as const,
    shareTokens: (pollId: number) => ['polls', pollId, 'share-tokens'] as const,
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
    member: ['events', 'member'] as const,
    memberDetail: (slug: string) =>
      ['events', 'member', 'detail', slug] as const,
  },
  calendar: {
    all: ['calendar'] as const,
    month: (monat: string) => ['calendar', 'month', monat] as const,
  },
  profile: {
    me: ['profile', 'me'] as const,
    calendarToken: ['profile', 'calendar-token'] as const,
  },
  kassa: {
    all: ['kassa'] as const,
    overview: ['kassa', 'overview'] as const,
    expenses: ['kassa', 'expenses'] as const,
    members: ['kassa', 'members'] as const,
    bankEntries: ['kassa', 'bank-entries'] as const,
  },
}
