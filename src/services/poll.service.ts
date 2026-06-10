import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type { NextEvent, Poll, SubmitVotesInput } from '~func/contracts/poll'

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

export function useNextEvent() {
  return useQuery({
    queryKey: queryKeys.polls.next,
    queryFn: () => apiClient<NextEvent>('/polls/next'),
    retry: (count, err) => {
      if ((err as { status?: number }).status === 404) return false
      return count < 1
    },
  })
}

export function usePoll(slug: string) {
  return useQuery({
    queryKey: queryKeys.polls.detail(slug),
    queryFn: () => apiClient<Poll>(`/polls/${slug}`),
  })
}

export function useSubmitVotes(pollSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SubmitVotesInput) =>
      apiClient<Poll>(`/polls/${pollSlug}/votes`, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.detail(pollSlug),
      })
    },
  })
}
