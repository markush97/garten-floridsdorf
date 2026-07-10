import { describe, expect, it } from 'vitest'
import {
  createEventShareTokenInputSchema,
  createEventShareTokenResponseSchema,
  sharedEventSchema,
} from '../contracts/event'
import {
  hashShareToken,
  isValidShareTokenShape,
  shareTokenFingerprint,
} from './share-token'

describe('isValidShareTokenShape', () => {
  it('accepts a 43-char base64url string', () => {
    expect(
      isValidShareTokenShape('abcdefghijklmnopqrstuvwxyz0123456789_-_-'),
    ).toBe(true)
  })

  it('rejects too-short strings', () => {
    expect(isValidShareTokenShape('short')).toBe(false)
  })

  it('rejects too-long strings', () => {
    expect(isValidShareTokenShape('a'.repeat(129))).toBe(false)
  })

  it('rejects base64url padding (we never emit it)', () => {
    expect(isValidShareTokenShape('a'.repeat(31) + '=')).toBe(false)
  })

  it('rejects characters outside the base64url alphabet', () => {
    expect(isValidShareTokenShape('a'.repeat(30) + '+')).toBe(false)
    expect(isValidShareTokenShape('a'.repeat(30) + '/')).toBe(false)
    expect(isValidShareTokenShape('a'.repeat(30) + '?')).toBe(false)
  })
})

describe('hashShareToken', () => {
  it('returns a 64-char hex string', async () => {
    const hash = await hashShareToken('hello')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic', async () => {
    const a = await hashShareToken('token-of-unique-power')
    const b = await hashShareToken('token-of-unique-power')
    expect(a).toBe(b)
  })

  it('changes when the input changes by a single byte', async () => {
    const a = await hashShareToken('token-A')
    const b = await hashShareToken('token-B')
    expect(a).not.toBe(b)
  })
})

describe('shareTokenFingerprint', () => {
  it('returns the first 8 characters', () => {
    expect(shareTokenFingerprint('abcdefghijklmnop')).toBe('abcdefgh')
  })

  it('returns the full token for short ones (no length error)', () => {
    expect(shareTokenFingerprint('short')).toBe('short')
  })
})

describe('createEventShareTokenInputSchema', () => {
  it('accepts an empty payload (only expires_at is required, and it is optional)', () => {
    const result = createEventShareTokenInputSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts a label', () => {
    const result = createEventShareTokenInputSchema.safeParse({
      label: 'Vorstand',
    })
    expect(result.success).toBe(true)
  })

  it('trims whitespace from the label; whitespace-only becomes null', () => {
    const trimmed = createEventShareTokenInputSchema.safeParse({
      label: '  Vorstand  ',
    })
    expect(trimmed.success).toBe(true)
    if (trimmed.success) {
      expect(trimmed.data.label).toBe('Vorstand')
    }
    // Whitespace-only normalises to null (no label) — this is by
    // design so a stray space in the admin UI doesn't create a
    // label-less "label".
    const empty = createEventShareTokenInputSchema.safeParse({
      label: '   ',
    })
    expect(empty.success).toBe(true)
    if (empty.success) {
      expect(empty.data.label).toBeNull()
    }
  })

  it('rejects an expires_at in the wrong format', () => {
    const result = createEventShareTokenInputSchema.safeParse({
      expires_at: '15.06.2026',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a YYYY-MM-DD expires_at', () => {
    const result = createEventShareTokenInputSchema.safeParse({
      expires_at: '2026-12-31',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown fields (strict)', () => {
    const result = createEventShareTokenInputSchema.safeParse({
      token: 'leaked',
    })
    expect(result.success).toBe(false)
  })
})

describe('createEventShareTokenResponseSchema', () => {
  it('accepts a well-formed response', () => {
    const result = createEventShareTokenResponseSchema.safeParse({
      token: {
        id: 1,
        event_id: 1,
        token_fingerprint: 'abcd1234',
        label: 'Newsletter',
        created_at: '2026-06-10T10:00:00.000Z',
        expires_at: null,
        revoked_at: null,
        last_hit_at: null,
      },
      plaintext: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a plaintext with invalid characters', () => {
    const result = createEventShareTokenResponseSchema.safeParse({
      token: {
        id: 1,
        event_id: 1,
        token_fingerprint: 'abcd1234',
        label: null,
        created_at: '2026-06-10T10:00:00.000Z',
        expires_at: null,
        revoked_at: null,
        last_hit_at: null,
      },
      plaintext: 'has spaces and = padding',
    })
    expect(result.success).toBe(false)
  })
})

describe('sharedEventSchema', () => {
  it('accepts a minimal public payload', () => {
    const result = sharedEventSchema.safeParse({
      title: 'Gartentreffen Juni',
      scheduled_date: '2026-06-15',
      scheduled_time: '15:00',
      location: 'Vereinshaus',
      agenda: 'Begrüßung, Wahl',
      slug: 'garten-juni',
      label: null,
      agenda_items: [{ title: 'Begrüßung', status: 'open', sort_order: 0 }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts an empty agenda list', () => {
    const result = sharedEventSchema.safeParse({
      title: 'Gartentreffen Juni',
      scheduled_date: '2026-06-15',
      scheduled_time: null,
      location: null,
      agenda: null,
      slug: 'garten-juni',
      label: null,
      agenda_items: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown agenda status', () => {
    const result = sharedEventSchema.safeParse({
      title: 'X',
      scheduled_date: '2026-06-15',
      scheduled_time: null,
      location: null,
      agenda: null,
      slug: 'x',
      label: null,
      agenda_items: [{ title: 'X', status: 'pending', sort_order: 0 }],
    })
    expect(result.success).toBe(false)
  })
})
