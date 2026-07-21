import { describe, expect, it } from 'vitest'
import {
  createTaskInputSchema,
  TASK_INTERVAL_UNIT_LABELS,
  TASK_INTERVAL_UNITS,
  TASK_STATE_LABELS,
  TASK_STATES,
  updateTaskInputSchema,
} from '../contracts/task'

describe('createTaskInputSchema', () => {
  it('accepts a minimal one-off task and defaults the state to idee', () => {
    const parsed = createTaskInputSchema.safeParse({ title: 'Beet gießen' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.state).toBe('idee')
      expect(parsed.data.recurrence).toBeUndefined()
    }
  })

  it('trims the title and rejects an empty one', () => {
    expect(createTaskInputSchema.safeParse({ title: '   ' }).success).toBe(
      false,
    )
  })

  it('rejects a malformed due date', () => {
    expect(
      createTaskInputSchema.safeParse({
        title: 'x',
        due_date: '21.07.2026',
      }).success,
    ).toBe(false)
  })

  it('rejects a non-positive or non-integer price estimate', () => {
    expect(
      createTaskInputSchema.safeParse({ title: 'x', price_estimate_cents: 0 })
        .success,
    ).toBe(false)
    expect(
      createTaskInputSchema.safeParse({ title: 'x', price_estimate_cents: 1.5 })
        .success,
    ).toBe(false)
  })

  it('accepts a valid recurrence rule', () => {
    const parsed = createTaskInputSchema.safeParse({
      title: 'Rasen mähen',
      recurrence: {
        interval_count: 2,
        interval_unit: 'week',
        start_date: '2026-07-21',
      },
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a recurrence with a zero interval', () => {
    expect(
      createTaskInputSchema.safeParse({
        title: 'x',
        recurrence: {
          interval_count: 0,
          interval_unit: 'week',
          start_date: '2026-07-21',
        },
      }).success,
    ).toBe(false)
  })

  it('rejects an unknown interval unit', () => {
    expect(
      createTaskInputSchema.safeParse({
        title: 'x',
        recurrence: {
          interval_count: 1,
          interval_unit: 'year',
          start_date: '2026-07-21',
        },
      }).success,
    ).toBe(false)
  })
})

describe('updateTaskInputSchema', () => {
  it('allows clearing the assignee and due date with null', () => {
    const parsed = updateTaskInputSchema.safeParse({
      assignee_user_id: null,
      due_date: null,
    })
    expect(parsed.success).toBe(true)
  })

  it('treats an omitted field as absent (undefined), not a clear', () => {
    const parsed = updateTaskInputSchema.safeParse({ state: 'ausfuehrung' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.due_date).toBeUndefined()
      expect(parsed.data.assignee_user_id).toBeUndefined()
    }
  })
})

describe('label maps', () => {
  it('cover every state and interval unit', () => {
    for (const s of TASK_STATES) expect(TASK_STATE_LABELS[s]).toBeTruthy()
    for (const u of TASK_INTERVAL_UNITS)
      expect(TASK_INTERVAL_UNIT_LABELS[u]).toBeTruthy()
  })
})
