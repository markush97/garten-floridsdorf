import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type { NextEvent, Poll, SubmitVotesInput } from '~func/contracts/poll'

export function useActivePoll() {
  return useQuery({
    queryKey: queryKeys.polls.active,
    queryFn: () => apiClient<Poll>('/polls/active'),
    retry: (count, err) => {
      const status = (err as { status?: number }).status
      if (status === 404 || status === 401) return false
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

function withToken(path: string, token?: string): string {
  return token ? `${path}?token=${encodeURIComponent(token)}` : path
}

export function usePoll(slug: string, token?: string) {
  return useQuery({
    queryKey: [...queryKeys.polls.detail(slug), token] as const,
    queryFn: () => apiClient<Poll>(withToken(`/polls/${slug}`, token)),
    retry: (count, err) => {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 404 || status === 410) return false
      return count < 1
    },
  })
}

export function useSubmitVotes(pollSlug: string, token?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SubmitVotesInput) =>
      apiClient<Poll>(withToken(`/polls/${pollSlug}/votes`, token), {
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
