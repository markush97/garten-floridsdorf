import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { gridRange } from '~/lib/calendar-grid'
import { queryKeys } from '~/lib/query-keys'
import type {
  CalendarBookingEntry,
  CalendarEventEntry,
  CalendarFeedTokenStatus,
  CalendarResponse,
  CreateBookingInput,
  CreateCalendarEventInput,
  CreateCalendarFeedTokenResponse,
  UpdateBookingInput,
  UpdateCalendarEventInput,
} from '~func/contracts/calendar'

/**
 * Keyed by month, fetching the padded grid range — the range is a
 * pure function of the month, so mutations can simply invalidate the
 * `['calendar']` prefix to refresh every cached month.
 */
export function useCalendarMonth(monat: string) {
  const { from, to } = gridRange(monat)
  return useQuery({
    queryKey: queryKeys.calendar.month(monat),
    queryFn: () =>
      apiClient<CalendarResponse>(`/calendar?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
    retry: (count, err) => {
      if ((err as { status?: number }).status === 401) return false
      return count < 1
    },
  })
}

function useInvalidateCalendar() {
  const queryClient = useQueryClient()
  return () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all })
}

export function useCreateCalendarEvent() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: (data: CreateCalendarEventInput) =>
      apiClient<CalendarEventEntry>('/calendar/events', {
        method: 'POST',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateCalendarEvent() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: UpdateCalendarEventInput
    }) =>
      apiClient<CalendarEventEntry>(`/calendar/events/${id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteCalendarEvent() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/calendar/events/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  })
}

export function useCreateBooking() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: (data: CreateBookingInput) =>
      apiClient<CalendarBookingEntry>('/calendar/bookings', {
        method: 'POST',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateBooking() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBookingInput }) =>
      apiClient<CalendarBookingEntry>(`/calendar/bookings/${id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: invalidate,
  })
}

export function useCancelBooking() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<CalendarBookingEntry>(`/calendar/bookings/${id}/cancel`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  })
}

// ── Personal iCal feed token ────────────────────────────────────────────────

export function useCalendarToken() {
  return useQuery({
    queryKey: queryKeys.profile.calendarToken,
    queryFn: () => apiClient<CalendarFeedTokenStatus>('/me/calendar-token'),
    retry: (count, err) => {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) return false
      return count < 1
    },
  })
}

export function useCreateCalendarToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<CreateCalendarFeedTokenResponse>('/me/calendar-token', {
        method: 'POST',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.profile.calendarToken,
      })
    },
  })
}

export function useDeleteCalendarToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<{ ok: boolean }>('/me/calendar-token', { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.profile.calendarToken,
      })
    },
  })
}
