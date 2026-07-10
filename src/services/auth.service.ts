import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type {
  AcceptInviteInput,
  InvitePreview,
  LoginInput,
  SessionUser,
} from '~func/contracts/auth'

export function useMe() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => apiClient<SessionUser>('/auth/me'),
    retry: false,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: LoginInput) =>
      apiClient<SessionUser>('/auth/login', { method: 'POST', body: data }),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.auth.me, me)
    },
  })
}

export function useRequestMagicLink() {
  return useMutation({
    mutationFn: (email: string) =>
      apiClient<{ ok: boolean }>('/auth/magic-link', {
        method: 'POST',
        body: { email },
      }),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear()
    },
  })
}

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: queryKeys.auth.invite(token),
    queryFn: () => apiClient<InvitePreview>(`/auth/invite/${token}`),
    retry: false,
  })
}

export function useAcceptInvite(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AcceptInviteInput) =>
      apiClient<SessionUser>(`/auth/invite/${token}`, {
        method: 'POST',
        body: data,
      }),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.auth.me, me)
    },
  })
}
