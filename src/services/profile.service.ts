import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type {
  ChangePasswordInput,
  MyProfile,
  UpdateMyProfileInput,
} from '~func/contracts/user'

export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.profile.me,
    queryFn: () => apiClient<MyProfile>('/me/profile'),
    retry: (count, err) => {
      const status = (err as { status?: number }).status
      // 403 = the bootstrap root admin, which has no profile row.
      if (status === 401 || status === 403) return false
      return count < 1
    },
  })
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateMyProfileInput) =>
      apiClient<MyProfile>('/me/profile', { method: 'PATCH', body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me })
      // A name change is reflected in the session (`me.name` renders
      // in the shell header), so refresh that too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordInput) =>
      apiClient<{ ok: boolean }>('/me/password', {
        method: 'POST',
        body: data,
      }),
  })
}
