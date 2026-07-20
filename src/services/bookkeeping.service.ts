import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type {
  BankEntrySummary,
  CreateBankEntryInput,
  CreateExpenseInput,
  ExpenseSummary,
  KassaMember,
  KassaOverview,
  UpdateBankEntryInput,
  UpdateExpenseInput,
} from '~func/contracts/bookkeeping'

function noSessionRetry(count: number, err: unknown): boolean {
  const status = (err as { status?: number }).status
  if (status === 401 || status === 403) return false
  return count < 1
}

export function useKassaOverview() {
  return useQuery({
    queryKey: queryKeys.kassa.overview,
    queryFn: () => apiClient<KassaOverview>('/kassa/overview'),
    retry: noSessionRetry,
  })
}

export function useExpenses() {
  return useQuery({
    queryKey: queryKeys.kassa.expenses,
    queryFn: () => apiClient<ExpenseSummary[]>('/kassa/expenses'),
    retry: noSessionRetry,
  })
}

export function useKassaMembers() {
  return useQuery({
    queryKey: queryKeys.kassa.members,
    queryFn: () => apiClient<KassaMember[]>('/kassa/members'),
    retry: noSessionRetry,
  })
}

/** Bank entries are Kassier-only — pass `enabled` to skip for members. */
export function useBankEntries(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.kassa.bankEntries,
    queryFn: () => apiClient<BankEntrySummary[]>('/kassa/bank-entries'),
    enabled,
    retry: noSessionRetry,
  })
}

function useInvalidateKassa() {
  const queryClient = useQueryClient()
  return () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.kassa.all })
}

export function useCreateExpense() {
  const invalidate = useInvalidateKassa()
  return useMutation({
    mutationFn: (data: CreateExpenseInput) =>
      apiClient<ExpenseSummary>('/kassa/expenses', {
        method: 'POST',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useUploadReceipt() {
  const invalidate = useInvalidateKassa()
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiClient<ExpenseSummary>(`/kassa/expenses/${id}/receipt`, {
        method: 'POST',
        body: formData,
      })
    },
    onSuccess: invalidate,
  })
}

export function useUpdateExpense() {
  const invalidate = useInvalidateKassa()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateExpenseInput }) =>
      apiClient<ExpenseSummary>(`/kassa/expenses/${id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteExpense() {
  const invalidate = useInvalidateKassa()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/kassa/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useApproveExpense() {
  const invalidate = useInvalidateKassa()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<ExpenseSummary>(`/kassa/expenses/${id}/approve`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  })
}

export function useRejectExpense() {
  const invalidate = useInvalidateKassa()
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string | null }) =>
      apiClient<ExpenseSummary>(`/kassa/expenses/${id}/reject`, {
        method: 'POST',
        body: { note },
      }),
    onSuccess: invalidate,
  })
}

export function useCreateBankEntry() {
  const invalidate = useInvalidateKassa()
  return useMutation({
    mutationFn: (data: CreateBankEntryInput) =>
      apiClient<BankEntrySummary>('/kassa/bank-entries', {
        method: 'POST',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateBankEntry() {
  const invalidate = useInvalidateKassa()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBankEntryInput }) =>
      apiClient<BankEntrySummary>(`/kassa/bank-entries/${id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteBankEntry() {
  const invalidate = useInvalidateKassa()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/kassa/bank-entries/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  })
}
