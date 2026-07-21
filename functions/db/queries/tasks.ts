import { and, asc, eq, isNotNull, isNull, lte } from 'drizzle-orm'
import { nowUtc, toVienna } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { advancePastToday } from '../../_lib/recurrence'
import { normalizeOptional } from '../../_lib/strings'
import type {
  CreateSubtaskInput,
  CreateTaskInput,
  Subtask,
  Task,
  TaskMember,
  TaskSeries,
  TasksResponse,
  UpdateSubtaskInput,
  UpdateTaskInput,
  UpdateTaskSeriesInput,
} from '../../contracts/task'
import {
  type TaskRow,
  type TaskSeriesRow,
  type TaskSubtaskRow,
  task_series,
  task_subtasks,
  tasks,
  users,
} from '../schema'

/** Vienna wall date (YYYY-MM-DD) for "today". */
function todayVienna(): string {
  return toVienna(nowUtc()).format('YYYY-MM-DD')
}

/** Resolves a member id to their full name, or null. */
async function resolveAssigneeName(
  db: Database,
  userId: number | null | undefined,
): Promise<string | null> {
  if (userId == null) return null
  const row = await db
    .select({ first_name: users.first_name, last_name: users.last_name })
    .from(users)
    .where(eq(users.id, userId))
    .get()
  if (!row) {
    throw new AppError('VALIDATION_ERROR', 'Mitglied nicht gefunden', 400)
  }
  return `${row.first_name} ${row.last_name}`
}

/** Activated members, for the assignee picker. */
export async function listAssignableMembers(
  db: Database,
): Promise<TaskMember[]> {
  const rows = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(users)
    .where(isNotNull(users.activated_at))
    .orderBy(asc(users.last_name), asc(users.first_name))
    .all()
  return rows.map((r) => ({
    user_id: r.id,
    name: `${r.first_name} ${r.last_name}`,
  }))
}

function shapeSubtask(row: TaskSubtaskRow): Subtask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    done: row.done,
    sort_order: row.sort_order,
  }
}

function shapeTask(row: TaskRow, subtasks: Subtask[]): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    state: row.state,
    price_estimate_cents: row.price_estimate_cents,
    due_date: row.due_date,
    assignee_user_id: row.assignee_user_id,
    assignee_name: row.assignee_name,
    series_id: row.series_id,
    created_by_user_id: row.created_by_user_id,
    created_by_name: row.created_by_name,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    subtasks,
  }
}

function shapeSeries(row: TaskSeriesRow, subtasks: Subtask[]): TaskSeries {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    state: row.state,
    price_estimate_cents: row.price_estimate_cents,
    assignee_user_id: row.assignee_user_id,
    assignee_name: row.assignee_name,
    interval_count: row.interval_count,
    interval_unit: row.interval_unit,
    next_occurrence_date: row.next_occurrence_date,
    active: row.active,
    created_by_user_id: row.created_by_user_id,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    subtasks,
  }
}

export async function findTaskOrThrow(
  db: Database,
  id: number,
): Promise<TaskRow> {
  const row = await db.select().from(tasks).where(eq(tasks.id, id)).get()
  if (!row) throw new AppError('NOT_FOUND', 'Aufgabe nicht gefunden', 404)
  return row
}

export async function findSeriesOrThrow(
  db: Database,
  id: number,
): Promise<TaskSeriesRow> {
  const row = await db
    .select()
    .from(task_series)
    .where(eq(task_series.id, id))
    .get()
  if (!row) throw new AppError('NOT_FOUND', 'Serie nicht gefunden', 404)
  return row
}

/** The full task (with its checklist) — the detail/response shape. */
export async function getTaskWithSubtasks(
  db: Database,
  id: number,
): Promise<Task> {
  const row = await findTaskOrThrow(db, id)
  const subs = await db
    .select()
    .from(task_subtasks)
    .where(eq(task_subtasks.task_id, id))
    .orderBy(asc(task_subtasks.sort_order), asc(task_subtasks.id))
    .all()
  return shapeTask(row, subs.map(shapeSubtask))
}

async function getSeriesWithSubtasks(
  db: Database,
  id: number,
): Promise<TaskSeries> {
  const row = await findSeriesOrThrow(db, id)
  const subs = await db
    .select()
    .from(task_subtasks)
    .where(eq(task_subtasks.series_id, id))
    .orderBy(asc(task_subtasks.sort_order), asc(task_subtasks.id))
    .all()
  return shapeSeries(row, subs.map(shapeSubtask))
}

/**
 * Spawns concrete tasks for every active series whose `next_occurrence_date`
 * has arrived (Vienna today), copying the series' checklist template onto the
 * new task and advancing the series past today. At most one task per series
 * per call — a dormant series does not back-fill missed intervals. Idempotent
 * for a given day.
 */
export async function materializeDueSeries(
  db: Database,
  today: string = todayVienna(),
): Promise<void> {
  const due = await db
    .select()
    .from(task_series)
    .where(
      and(
        eq(task_series.active, true),
        lte(task_series.next_occurrence_date, today),
      ),
    )
    .all()

  for (const series of due) {
    const now = nowUtc()
    const inserted = await db
      .insert(tasks)
      .values({
        title: series.title,
        description: series.description,
        state: series.state,
        price_estimate_cents: series.price_estimate_cents,
        due_date: series.next_occurrence_date,
        assignee_user_id: series.assignee_user_id,
        assignee_name: series.assignee_name,
        series_id: series.id,
        created_by_user_id: series.created_by_user_id,
        created_by_name: series.created_by_name,
        created_at: now,
        updated_at: now,
      })
      .returning()
    const task = inserted[0]
    if (!task) continue

    const templates = await db
      .select()
      .from(task_subtasks)
      .where(eq(task_subtasks.series_id, series.id))
      .orderBy(asc(task_subtasks.sort_order), asc(task_subtasks.id))
      .all()
    if (templates.length > 0) {
      await db.insert(task_subtasks).values(
        templates.map((t, i) => ({
          task_id: task.id,
          series_id: null,
          title: t.title,
          description: t.description,
          done: false,
          sort_order: i,
        })),
      )
    }

    await db
      .update(task_series)
      .set({
        next_occurrence_date: advancePastToday(
          series.next_occurrence_date,
          series.interval_count,
          series.interval_unit,
          today,
        ),
        updated_at: now,
      })
      .where(eq(task_series.id, series.id))
  }
}

/** The whole board: materializes due series first, then lists everything. */
export async function listTasks(db: Database): Promise<TasksResponse> {
  await materializeDueSeries(db)

  const taskRows = await db
    .select()
    .from(tasks)
    .orderBy(asc(tasks.created_at), asc(tasks.id))
    .all()
  const seriesRows = await db
    .select()
    .from(task_series)
    .orderBy(asc(task_series.created_at), asc(task_series.id))
    .all()
  const subRows = await db
    .select()
    .from(task_subtasks)
    .orderBy(asc(task_subtasks.sort_order), asc(task_subtasks.id))
    .all()

  const byTask = new Map<number, Subtask[]>()
  const bySeries = new Map<number, Subtask[]>()
  for (const sub of subRows) {
    if (sub.task_id != null) {
      const list = byTask.get(sub.task_id) ?? []
      list.push(shapeSubtask(sub))
      byTask.set(sub.task_id, list)
    } else if (sub.series_id != null) {
      const list = bySeries.get(sub.series_id) ?? []
      list.push(shapeSubtask(sub))
      bySeries.set(sub.series_id, list)
    }
  }

  return {
    tasks: taskRows.map((row) => shapeTask(row, byTask.get(row.id) ?? [])),
    series: seriesRows.map((row) =>
      shapeSeries(row, bySeries.get(row.id) ?? []),
    ),
  }
}

/** completed_at is stamped only when a task actually reaches "abgeschlossen". */
function completedAtFor(state: string, now: string): string | null {
  return state === 'abgeschlossen' ? now : null
}

/**
 * Creates a task. With a `recurrence`, this creates a recurring series (whose
 * checklist becomes a per-occurrence template) and immediately materializes
 * any occurrence already due; the concrete task then appears via the series.
 * Without one, it creates a single task.
 */
export async function createTask(
  db: Database,
  input: CreateTaskInput,
  creator: { id: number | null; name: string },
): Promise<{ task: Task | null; series: TaskSeries | null }> {
  const now = nowUtc()
  const assigneeName = await resolveAssigneeName(db, input.assignee_user_id)

  if (input.recurrence) {
    const inserted = await db
      .insert(task_series)
      .values({
        title: input.title,
        description: normalizeOptional(input.description),
        state: input.state,
        price_estimate_cents: input.price_estimate_cents ?? null,
        assignee_user_id: input.assignee_user_id ?? null,
        assignee_name: assigneeName,
        interval_count: input.recurrence.interval_count,
        interval_unit: input.recurrence.interval_unit,
        next_occurrence_date: input.recurrence.start_date,
        active: true,
        created_by_user_id: creator.id,
        created_by_name: creator.name,
        created_at: now,
        updated_at: now,
      })
      .returning()
    const seriesRow = inserted[0]
    if (!seriesRow) {
      throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
    }
    if (input.subtasks?.length) {
      await db.insert(task_subtasks).values(
        input.subtasks.map((s, i) => ({
          task_id: null,
          series_id: seriesRow.id,
          title: s.title,
          description: normalizeOptional(s.description),
          done: false,
          sort_order: i,
        })),
      )
    }
    await materializeDueSeries(db)
    return { task: null, series: await getSeriesWithSubtasks(db, seriesRow.id) }
  }

  const inserted = await db
    .insert(tasks)
    .values({
      title: input.title,
      description: normalizeOptional(input.description),
      state: input.state,
      price_estimate_cents: input.price_estimate_cents ?? null,
      due_date: input.due_date ?? null,
      assignee_user_id: input.assignee_user_id ?? null,
      assignee_name: assigneeName,
      series_id: null,
      created_by_user_id: creator.id,
      created_by_name: creator.name,
      completed_at: completedAtFor(input.state, now),
      created_at: now,
      updated_at: now,
    })
    .returning()
  const taskRow = inserted[0]
  if (!taskRow) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }
  if (input.subtasks?.length) {
    await db.insert(task_subtasks).values(
      input.subtasks.map((s, i) => ({
        task_id: taskRow.id,
        series_id: null,
        title: s.title,
        description: normalizeOptional(s.description),
        done: false,
        sort_order: i,
      })),
    )
  }
  return { task: await getTaskWithSubtasks(db, taskRow.id), series: null }
}

export async function updateTask(
  db: Database,
  id: number,
  input: UpdateTaskInput,
): Promise<Task> {
  const existing = await findTaskOrThrow(db, id)
  const now = nowUtc()
  const updates: Partial<typeof tasks.$inferInsert> = { updated_at: now }

  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) {
    updates.description = normalizeOptional(input.description)
  }
  if (input.price_estimate_cents !== undefined) {
    updates.price_estimate_cents = input.price_estimate_cents
  }
  if (input.due_date !== undefined) updates.due_date = input.due_date
  if (input.assignee_user_id !== undefined) {
    updates.assignee_user_id = input.assignee_user_id
    updates.assignee_name = await resolveAssigneeName(
      db,
      input.assignee_user_id,
    )
  }
  if (input.state !== undefined) {
    updates.state = input.state
    // Stamp/clear the completion time on transitions in and out of
    // "abgeschlossen"; keep the original stamp if it was already done.
    if (input.state === 'abgeschlossen') {
      updates.completed_at = existing.completed_at ?? now
    } else {
      updates.completed_at = null
    }
  }

  await db.update(tasks).set(updates).where(eq(tasks.id, id))
  return getTaskWithSubtasks(db, id)
}

export async function deleteTask(db: Database, id: number): Promise<void> {
  await findTaskOrThrow(db, id)
  await db.delete(tasks).where(eq(tasks.id, id))
}

// ── Sub-tasks (checklist on a concrete task) ─────────────────────────────────

async function nextSubtaskOrder(db: Database, taskId: number): Promise<number> {
  const rows = await db
    .select({ sort_order: task_subtasks.sort_order })
    .from(task_subtasks)
    .where(eq(task_subtasks.task_id, taskId))
    .all()
  return rows.reduce((max, r) => Math.max(max, r.sort_order + 1), 0)
}

export async function addSubtask(
  db: Database,
  taskId: number,
  input: CreateSubtaskInput,
): Promise<Task> {
  await findTaskOrThrow(db, taskId)
  await db.insert(task_subtasks).values({
    task_id: taskId,
    series_id: null,
    title: input.title,
    description: normalizeOptional(input.description),
    done: false,
    sort_order: await nextSubtaskOrder(db, taskId),
  })
  await touchTask(db, taskId)
  return getTaskWithSubtasks(db, taskId)
}

async function findSubtaskForTaskOrThrow(
  db: Database,
  taskId: number,
  subtaskId: number,
): Promise<TaskSubtaskRow> {
  const row = await db
    .select()
    .from(task_subtasks)
    .where(
      and(
        eq(task_subtasks.id, subtaskId),
        eq(task_subtasks.task_id, taskId),
        isNull(task_subtasks.series_id),
      ),
    )
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Teilaufgabe nicht gefunden', 404)
  }
  return row
}

export async function updateSubtask(
  db: Database,
  taskId: number,
  subtaskId: number,
  input: UpdateSubtaskInput,
): Promise<Task> {
  await findSubtaskForTaskOrThrow(db, taskId, subtaskId)
  const updates: Partial<typeof task_subtasks.$inferInsert> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) {
    updates.description = normalizeOptional(input.description)
  }
  if (input.done !== undefined) updates.done = input.done
  if (Object.keys(updates).length > 0) {
    await db
      .update(task_subtasks)
      .set(updates)
      .where(eq(task_subtasks.id, subtaskId))
    await touchTask(db, taskId)
  }
  return getTaskWithSubtasks(db, taskId)
}

export async function deleteSubtask(
  db: Database,
  taskId: number,
  subtaskId: number,
): Promise<Task> {
  await findSubtaskForTaskOrThrow(db, taskId, subtaskId)
  await db.delete(task_subtasks).where(eq(task_subtasks.id, subtaskId))
  await touchTask(db, taskId)
  return getTaskWithSubtasks(db, taskId)
}

async function touchTask(db: Database, id: number): Promise<void> {
  await db.update(tasks).set({ updated_at: nowUtc() }).where(eq(tasks.id, id))
}

// ── Recurring series management ──────────────────────────────────────────────

export async function updateSeries(
  db: Database,
  id: number,
  input: UpdateTaskSeriesInput,
): Promise<TaskSeries> {
  await findSeriesOrThrow(db, id)
  const now = nowUtc()
  const updates: Partial<typeof task_series.$inferInsert> = { updated_at: now }

  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) {
    updates.description = normalizeOptional(input.description)
  }
  if (input.state !== undefined) updates.state = input.state
  if (input.price_estimate_cents !== undefined) {
    updates.price_estimate_cents = input.price_estimate_cents
  }
  if (input.assignee_user_id !== undefined) {
    updates.assignee_user_id = input.assignee_user_id
    updates.assignee_name = await resolveAssigneeName(
      db,
      input.assignee_user_id,
    )
  }
  if (input.interval_count !== undefined) {
    updates.interval_count = input.interval_count
  }
  if (input.interval_unit !== undefined) {
    updates.interval_unit = input.interval_unit
  }
  if (input.next_occurrence_date !== undefined) {
    updates.next_occurrence_date = input.next_occurrence_date
  }
  if (input.active !== undefined) updates.active = input.active

  await db.update(task_series).set(updates).where(eq(task_series.id, id))
  return getSeriesWithSubtasks(db, id)
}

/**
 * Stops a recurring series. Already-generated tasks keep their data — their
 * `series_id` is cleared by the FK's ON DELETE SET NULL, so they simply
 * become ordinary one-off tasks.
 */
export async function deleteSeries(db: Database, id: number): Promise<void> {
  await findSeriesOrThrow(db, id)
  await db.delete(task_series).where(eq(task_series.id, id))
}
