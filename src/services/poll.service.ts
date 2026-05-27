import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type { Poll, SubmitVotesInput } from '~func/contracts/poll'

export function useActivePoll() {
  return useQuery({
    queryKey: queryKeys.polls.active,
    queryFn: () => apiClient<Poll>('/polls/active'),
    retry: (count, err) => {
      if ((err as { status?: number }).status === 404) return false
      return count < 1
    },
  })
}

export function usePoll(id: string) {
  return useQuery({
    queryKey: queryKeys.polls.detail(id),
    queryFn: () => apiClient<Poll>(`/polls/${id}`),
  })
}

export function useSubmitVotes(pollId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SubmitVotesInput) =>
      apiClient<Poll>(`/polls/${pollId}/votes`, { method: 'POST', body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.detail(pollId),
      })
    },
  })
}
