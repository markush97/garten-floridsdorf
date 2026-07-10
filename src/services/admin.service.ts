import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type {
  AddPollOptionsInput,
  CreatePollInput,
  CreatePollShareTokenInput,
  CreatePollShareTokenResponse,
  FinalizePollInput,
  Poll,
  PollShareToken,
} from '~func/contracts/poll'

type AdminPoll = {
  id: number
  slug: string
  title: string
  description: string | null
  is_active: boolean
  final_option_id: number | null
  created_at: string
  closed_at: string | null
}

// Kept as a private alias so the public service surface doesn't grow
// unnecessarily — mirrors `AdminShareToken` in event.service.ts.
type AdminPollShareToken = PollShareToken & { is_active: boolean }

export function useAdminPolls() {
  return useQuery({
    queryKey: queryKeys.polls.admin,
    queryFn: () => apiClient<AdminPoll[]>('/admin/polls'),
    retry: (count, err) => {
      if ((err as { status?: number }).status === 401) return false
      return count < 1
    },
  })
}

export function useCreatePoll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePollInput) =>
      apiClient<Poll>('/admin/polls', { method: 'POST', body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.admin })
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.active })
    },
  })
}

export function useFinalizePoll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FinalizePollInput }) =>
      apiClient<Poll>(`/admin/polls/${id}`, { method: 'PATCH', body: data }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.admin })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.detail(String(id)),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.active })
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.next })
    },
  })
}

export function useDeletePoll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/admin/polls/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.admin })
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.active })
    },
  })
}

export function useAddPollOptions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AddPollOptionsInput }) =>
      apiClient<Poll>(`/admin/polls/${id}/options`, {
        method: 'POST',
        body: data,
      }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.admin })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.detail(String(id)),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.active })
    },
  })
}

// ── Invite share tokens ──────────────────────────────────────────────────────

export function usePollShareTokens(pollId: number) {
  return useQuery({
    queryKey: queryKeys.polls.shareTokens(pollId),
    queryFn: () =>
      apiClient<AdminPollShareToken[]>(`/admin/polls/${pollId}/share-tokens`),
  })
}

export function useCreatePollShareToken(pollId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePollShareTokenInput) =>
      apiClient<CreatePollShareTokenResponse>(
        `/admin/polls/${pollId}/share-tokens`,
        { method: 'POST', body: data },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.shareTokens(pollId),
      })
    },
  })
}

export function useRevokePollShareToken(pollId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<AdminPollShareToken>(
        `/admin/polls/${pollId}/share-tokens/${id}/revoke`,
        { method: 'POST', body: {} },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.shareTokens(pollId),
      })
    },
  })
}
