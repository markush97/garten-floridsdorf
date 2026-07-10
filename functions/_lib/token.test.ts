import { describe, expect, it } from 'vitest'
import { generateToken, hashToken, isValidTokenShape } from './token'

describe('generateToken', () => {
  it('generates a valid-shaped, unique token each time', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
    expect(isValidTokenShape(a)).toBe(true)
    expect(isValidTokenShape(b)).toBe(true)
  })
})

describe('hashToken', () => {
  it('is deterministic', async () => {
    const a = await hashToken('token-of-unique-power')
    const b = await hashToken('token-of-unique-power')
    expect(a).toBe(b)
  })

  it('differs for different inputs', async () => {
    const a = await hashToken('token-A')
    const b = await hashToken('token-B')
    expect(a).not.toBe(b)
  })
})

describe('isValidTokenShape', () => {
  it('accepts base64url alphabet within the length band', () => {
    expect(isValidTokenShape('abcdefghijklmnopqrstuvwxyz0123456789_-_-')).toBe(
      true,
    )
  })

  it('rejects strings shorter than 20 chars', () => {
    expect(isValidTokenShape('short')).toBe(false)
  })

  it('rejects strings longer than 128 chars', () => {
    expect(isValidTokenShape('a'.repeat(129))).toBe(false)
  })

  it('rejects characters outside the base64url alphabet', () => {
    expect(isValidTokenShape(`${'a'.repeat(30)}+`)).toBe(false)
    expect(isValidTokenShape(`${'a'.repeat(30)}/`)).toBe(false)
    expect(isValidTokenShape(`${'a'.repeat(30)}=`)).toBe(false)
  })
})
