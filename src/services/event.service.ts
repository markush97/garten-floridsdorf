import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type {
  CreateEventAgendaItemInput,
  CreateEventAgendaVoteInput,
  CreateEventAttendeeInput,
  CreateEventDecisionInput,
  CreateEventInput,
  Event,
  EventAgendaVote,
  EventAttachment,
  EventDecision,
  EventWithDetails,
  UpdateAttendeeVoteInput,
  UpdateEventAgendaItemInput,
  UpdateEventAgendaVoteInput,
  UpdateEventAttachmentInput,
  UpdateEventAttendeesInput,
  UpdateEventDecisionInput,
  UpdateEventInput,
} from '~func/contracts/event'

export function useAdminEvents() {
  return useQuery({
    queryKey: queryKeys.events.admin,
    queryFn: () => apiClient<Event[]>('/admin/events'),
    retry: (count, err) => {
      if ((err as { status?: number }).status === 401) return false
      return count < 1
    },
  })
}

export function useAdminEventForPoll(pollId: number | null) {
  return useQuery({
    enabled: pollId !== null,
    queryKey: queryKeys.events.forPoll(pollId ?? 0),
    queryFn: () => apiClient<Event>(`/admin/events/by-poll/${pollId}`),
  })
}

export function useAdminEvent(slug: string) {
  return useQuery({
    queryKey: queryKeys.events.detail(slug),
    queryFn: () => apiClient<EventWithDetails>(`/admin/events/${slug}`),
    retry: (count, err) => {
      if ((err as { status?: number }).status === 404) return false
      if ((err as { status?: number }).status === 401) return false
      return count < 1
    },
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEventInput) =>
      apiClient<Event>('/admin/events', { method: 'POST', body: data }),
    onSuccess: (event) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.events.admin })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.forPoll(event.poll_id ?? 0),
      })
    },
  })
}

export function useUpdateEvent(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateEventInput) =>
      apiClient<EventWithDetails>(`/admin/events/${slug}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: (event) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.events.admin })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
      // Slug may have been regenerated on rename.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(event.slug),
      })
      if (event.poll_id !== null) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.events.forPoll(event.poll_id),
        })
      }
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) =>
      apiClient<{ ok: boolean }>(`/admin/events/${slug}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.events.admin })
    },
  })
}

export function useReplacePlannedAttendees(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateEventAttendeesInput) =>
      apiClient<EventWithDetails>(`/admin/events/${slug}/planned-attendees`, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useReplaceActualAttendees(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateEventAttendeesInput) =>
      apiClient<EventWithDetails>(`/admin/events/${slug}/actual-attendees`, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useAddPlannedAttendee(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEventAttendeeInput) =>
      apiClient(`/admin/events/${slug}/planned-attendees/single`, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useAddActualAttendee(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEventAttendeeInput) =>
      apiClient(`/admin/events/${slug}/actual-attendees/single`, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useRemovePlannedAttendee(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(
        `/admin/events/${slug}/planned-attendees/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useRemoveActualAttendee(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(
        `/admin/events/${slug}/actual-attendees/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

// ── Agenda items ──────────────────────────────────────────────────────────

export function useAddAgendaItem(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEventAgendaItemInput) =>
      apiClient(`/admin/events/${slug}/agenda-items`, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useUpdateAgendaItem(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: UpdateEventAgendaItemInput
    }) =>
      apiClient(`/admin/events/${slug}/agenda-items/${id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useDeleteAgendaItem(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/admin/events/${slug}/agenda-items/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useReorderAgendaItems(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (order: number[]) =>
      apiClient(`/admin/events/${slug}/agenda-items/order`, {
        method: 'PUT',
        body: { order },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

// ── Agenda votes ──────────────────────────────────────────────────────────

export function useAddAgendaVote(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      agendaItemId,
      data,
    }: {
      agendaItemId: number
      data: CreateEventAgendaVoteInput
    }) =>
      apiClient<EventAgendaVote>(
        `/admin/events/${slug}/agenda-items/${agendaItemId}/votes`,
        { method: 'POST', body: data },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useUpdateAgendaVote(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      voteId,
      data,
    }: {
      voteId: number
      data: UpdateEventAgendaVoteInput
    }) =>
      apiClient<EventAgendaVote>(
        `/admin/events/${slug}/agenda-votes/${voteId}`,
        { method: 'PATCH', body: data },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useDeleteAgendaVote(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (voteId: number) =>
      apiClient<{ ok: boolean }>(
        `/admin/events/${slug}/agenda-votes/${voteId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useSetAttendeeVote(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      voteId,
      attendeeId,
      data,
    }: {
      voteId: number
      attendeeId: number
      data: UpdateAttendeeVoteInput
    }) =>
      apiClient<{ ok: boolean; cleared: boolean }>(
        `/admin/events/${slug}/agenda-votes/${voteId}/attendees/${attendeeId}`,
        { method: 'PUT', body: data },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

// ── Attachments ───────────────────────────────────────────────────────────

/**
 * Uploads a single file to an event (or to a specific agenda item).
 * The browser sends the file as multipart/form-data; the worker
 * streams it to R2 and writes the metadata row in one go.
 */
export function useUploadAttachment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      file: File
      agenda_item_id?: number | null
      caption?: string
    }) => {
      const formData = new FormData()
      formData.append('file', input.file)
      if (input.agenda_item_id !== undefined && input.agenda_item_id !== null) {
        formData.append('agenda_item_id', String(input.agenda_item_id))
      }
      if (input.caption) {
        formData.append('caption', input.caption)
      }
      return apiClient<EventAttachment>(`/admin/events/${slug}/attachments`, {
        method: 'POST',
        body: formData,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useUpdateAttachment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: UpdateEventAttachmentInput
    }) =>
      apiClient<EventAttachment>(`/admin/events/${slug}/attachments/${id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useDeleteAttachment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/admin/events/${slug}/attachments/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

// ── Decisions / Beschlüsse ────────────────────────────────────────────────

export function useCreateDecision(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEventDecisionInput) =>
      apiClient<EventDecision>(`/admin/events/${slug}/decisions`, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useUpdateDecision(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: UpdateEventDecisionInput
    }) =>
      apiClient<EventDecision>(`/admin/events/${slug}/decisions/${id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}

export function useDeleteDecision(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/admin/events/${slug}/decisions/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(slug),
      })
    },
  })
}
