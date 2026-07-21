import { z } from 'zod'
import { amountCentsSchema } from './bookkeeping'
import { isoDateSchema } from './calendar'

// ── Enumerations + German labels ─────────────────────────────────────────────
// The `*_LABELS` maps are the single source of truth for the German UI text so
// the client and the server never drift apart.

/** Lifecycle state of a task (Kanban-style). */
export const TASK_STATES = [
  'idee',
  'planung',
  'ausfuehrung',
  'blockiert',
  'abgeschlossen',
  'abgebrochen',
] as const
export type TaskState = (typeof TASK_STATES)[number]
export const TASK_STATE_LABELS: Record<TaskState, string> = {
  idee: 'Idee',
  planung: 'Planung',
  ausfuehrung: 'Ausführung',
  blockiert: 'Warten/Blockiert',
  abgeschlossen: 'Abgeschlossen',
  abgebrochen: 'Abgebrochen',
}

/** States that count as "closed" — a task in one of these is finished. */
export const CLOSED_TASK_STATES: readonly TaskState[] = [
  'abgeschlossen',
  'abgebrochen',
]

/** Interval unit for a recurring series. */
export const TASK_INTERVAL_UNITS = ['day', 'week', 'month'] as const
export type TaskIntervalUnit = (typeof TASK_INTERVAL_UNITS)[number]
export const TASK_INTERVAL_UNIT_LABELS: Record<TaskIntervalUnit, string> = {
  day: 'Tage',
  week: 'Wochen',
  month: 'Monate',
}

// ── Shared field schemas ─────────────────────────────────────────────────────

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Bitte einen Titel eingeben.')
  .max(200)

const optionalLongText = z
  .preprocess(
    (v) => (v == null ? '' : v),
    z
      .string()
      .max(5000)
      .transform((v) => v.trim())
      .transform((v) => (v.length === 0 ? null : v)),
  )
  .nullish()

const assigneeIdSchema = z.number().int().positive().nullish()
const priceSchema = amountCentsSchema.nullish()

/** One checklist item as sent from the client when creating/editing. */
export const subtaskInputSchema = z.object({
  title: titleSchema,
  description: optionalLongText,
})

/** Recurrence rule attached to a create request to spin up a series. */
export const recurrenceInputSchema = z.object({
  interval_count: z
    .number()
    .int('Bitte ein ganzzahliges Intervall angeben.')
    .min(1, 'Das Intervall muss mindestens 1 sein.')
    .max(365, 'Das Intervall ist zu groß.'),
  interval_unit: z.enum(TASK_INTERVAL_UNITS),
  // The date of the first occurrence; the series spawns from here.
  start_date: isoDateSchema,
})

// ── Task input ───────────────────────────────────────────────────────────────

/**
 * Creating a task. When `recurrence` is present the request creates a
 * recurring series instead of (well, in addition to) a concrete task: the
 * series owns the interval and the checklist becomes a per-occurrence
 * template. For a one-off, `recurrence` is null and `due_date` applies to the
 * single task.
 */
export const createTaskInputSchema = z.object({
  title: titleSchema,
  description: optionalLongText,
  state: z.enum(TASK_STATES).default('idee'),
  price_estimate_cents: priceSchema,
  due_date: isoDateSchema.nullish(),
  assignee_user_id: assigneeIdSchema,
  subtasks: z.array(subtaskInputSchema).max(50).optional(),
  recurrence: recurrenceInputSchema.nullish(),
})

export const updateTaskInputSchema = z.object({
  title: titleSchema.optional(),
  description: optionalLongText,
  state: z.enum(TASK_STATES).optional(),
  price_estimate_cents: priceSchema,
  due_date: isoDateSchema.nullish(),
  assignee_user_id: assigneeIdSchema,
})

/** Editing a recurring series' template fields + schedule. */
export const updateTaskSeriesInputSchema = z.object({
  title: titleSchema.optional(),
  description: optionalLongText,
  state: z.enum(TASK_STATES).optional(),
  price_estimate_cents: priceSchema,
  assignee_user_id: assigneeIdSchema,
  interval_count: recurrenceInputSchema.shape.interval_count.optional(),
  interval_unit: z.enum(TASK_INTERVAL_UNITS).optional(),
  next_occurrence_date: isoDateSchema.optional(),
  active: z.boolean().optional(),
})

export const updateSubtaskInputSchema = z.object({
  title: titleSchema.optional(),
  description: optionalLongText,
  done: z.boolean().optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>
export type UpdateTaskSeriesInput = z.infer<typeof updateTaskSeriesInputSchema>
export type CreateSubtaskInput = z.infer<typeof subtaskInputSchema>
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskInputSchema>
export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>

// ── Response shapes ──────────────────────────────────────────────────────────

/** A member option for the assignee picker (activated members only). */
export type TaskMember = {
  user_id: number
  name: string
}

export type Subtask = {
  id: number
  title: string
  description: string | null
  done: boolean
  sort_order: number
}

export type Task = {
  id: number
  title: string
  description: string | null
  state: TaskState
  price_estimate_cents: number | null
  due_date: string | null
  assignee_user_id: number | null
  assignee_name: string | null
  series_id: number | null
  created_by_user_id: number | null
  created_by_name: string
  completed_at: string | null
  created_at: string
  updated_at: string
  subtasks: Subtask[]
}

export type TaskSeries = {
  id: number
  title: string
  description: string | null
  state: TaskState
  price_estimate_cents: number | null
  assignee_user_id: number | null
  assignee_name: string | null
  interval_count: number
  interval_unit: TaskIntervalUnit
  next_occurrence_date: string
  active: boolean
  created_by_user_id: number | null
  created_by_name: string
  created_at: string
  updated_at: string
  subtasks: Subtask[]
}

/** Payload of `GET /tasks` — the whole board plus the recurring series. */
export type TasksResponse = {
  tasks: Task[]
  series: TaskSeries[]
}
