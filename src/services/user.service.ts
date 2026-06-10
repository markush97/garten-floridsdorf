import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type {
  CreateUserInput,
  UpdateUserInput,
  User,
} from '~func/contracts/user'

export function useAdminUsers() {
  return useQuery({
    queryKey: queryKeys.users.admin,
    queryFn: () => apiClient<User[]>('/admin/users'),
    retry: (count, err) => {
      if ((err as { status?: number }).status === 401) return false
      return count < 1
    },
  })
}

export function useAdminUser(slug: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(slug),
    queryFn: () => apiClient<User>(`/admin/users/${slug}`),
    retry: (count, err) => {
      if ((err as { status?: number }).status === 404) return false
      if ((err as { status?: number }).status === 401) return false
      return count < 1
    },
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserInput) =>
      apiClient<User>('/admin/users', { method: 'POST', body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.admin })
    },
  })
}

export function useUpdateUser(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateUserInput) =>
      apiClient<User>(`/admin/users/${slug}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.admin })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.detail(slug),
      })
      // The slug may have been regenerated on rename, so invalidate by
      // the new slug too — otherwise the next visit to that detail would
      // hit a stale cache.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.detail(user.slug),
      })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) =>
      apiClient<{ ok: boolean }>(`/admin/users/${slug}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.admin })
    },
  })
}
