import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type {
  AddPollOptionsInput,
  CreatePollInput,
  FinalizePollInput,
  Poll,
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

export function useAdminLogin() {
  return useMutation({
    mutationFn: (password: string) =>
      apiClient<{ ok: boolean }>('/admin/login', {
        method: 'POST',
        body: { password },
      }),
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
