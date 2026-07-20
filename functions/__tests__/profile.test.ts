import { describe, expect, it } from 'vitest'
import {
  changePasswordInputSchema,
  myProfileSchema,
  updateMyProfileInputSchema,
} from '../contracts/user'

describe('myProfileSchema', () => {
  it('extends the user shape with address and the notification flag', () => {
    const result = myProfileSchema.safeParse({
      id: 1,
      slug: 'maria-muster',
      first_name: 'Maria',
      last_name: 'Muster',
      email: 'maria@example.at',
      phone: null,
      description: null,
      username: 'maria',
      role: 'member',
      activated_at: '2026-06-10T10:00:00.000Z',
      created_at: '2026-06-10T10:00:00.000Z',
      updated_at: '2026-06-10T10:00:00.000Z',
      address: 'Beispielgasse 1, 1210 Wien',
      notify_calendar_email: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('updateMyProfileInputSchema', () => {
  it('lowercases the e-mail and normalizes empty strings to null', () => {
    const result = updateMyProfileInputSchema.safeParse({
      email: '  Maria@Example.AT ',
      phone: '',
      address: '  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('maria@example.at')
      expect(result.data.phone).toBeNull()
      expect(result.data.address).toBeNull()
      expect(result.data.first_name).toBeUndefined()
    }
  })

  it('rejects invalid e-mail addresses and usernames', () => {
    expect(
      updateMyProfileInputSchema.safeParse({ email: 'keine-mail' }).success,
    ).toBe(false)
    expect(
      updateMyProfileInputSchema.safeParse({ username: 'A b' }).success,
    ).toBe(false)
  })

  it('applies the shared username rules', () => {
    const result = updateMyProfileInputSchema.safeParse({
      username: '  Maria.Muster ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.username).toBe('maria.muster')
  })
})

describe('changePasswordInputSchema', () => {
  it('requires the current password and 8+ characters for the new one', () => {
    expect(
      changePasswordInputSchema.safeParse({
        current_password: 'altespasswort',
        new_password: 'neuespasswort',
      }).success,
    ).toBe(true)
    expect(
      changePasswordInputSchema.safeParse({
        current_password: '',
        new_password: 'neuespasswort',
      }).success,
    ).toBe(false)
    expect(
      changePasswordInputSchema.safeParse({
        current_password: 'altespasswort',
        new_password: 'kurz',
      }).success,
    ).toBe(false)
  })
})
