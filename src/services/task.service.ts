import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type {
  CreateSubtaskInput,
  CreateTaskInput,
  Task,
  TaskMember,
  TaskSeries,
  TasksResponse,
  UpdateSubtaskInput,
  UpdateTaskInput,
  UpdateTaskSeriesInput,
} from '~func/contracts/task'

export function useTasks() {
  return useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: () => apiClient<TasksResponse>('/tasks'),
    retry: (count, err) => {
      if ((err as { status?: number }).status === 401) return false
      return count < 1
    },
  })
}

export function useTaskMembers() {
  return useQuery({
    queryKey: queryKeys.tasks.members,
    queryFn: () => apiClient<TaskMember[]>('/tasks/members'),
    retry: (count, err) => {
      if ((err as { status?: number }).status === 401) return false
      return count < 1
    },
  })
}

function useInvalidateTasks() {
  const queryClient = useQueryClient()
  return () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (data: CreateTaskInput) =>
      apiClient<{ task: Task | null; series: TaskSeries | null }>('/tasks', {
        method: 'POST',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskInput }) =>
      apiClient<Task>(`/tasks/${id}`, { method: 'PATCH', body: data }),
    onSuccess: invalidate,
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useAddSubtask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateSubtaskInput }) =>
      apiClient<Task>(`/tasks/${id}/subtasks`, { method: 'POST', body: data }),
    onSuccess: invalidate,
  })
}

export function useUpdateSubtask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({
      id,
      subId,
      data,
    }: {
      id: number
      subId: number
      data: UpdateSubtaskInput
    }) =>
      apiClient<Task>(`/tasks/${id}/subtasks/${subId}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteSubtask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, subId }: { id: number; subId: number }) =>
      apiClient<Task>(`/tasks/${id}/subtasks/${subId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useUpdateTaskSeries() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskSeriesInput }) =>
      apiClient<TaskSeries>(`/task-series/${id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteTaskSeries() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/task-series/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
