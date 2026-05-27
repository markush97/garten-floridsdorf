import { expect, test } from '@playwright/test'

// Requires the dev server to be running: wrangler pages dev
// Set E2E_ADMIN_PASSWORD env var to match the ADMIN_PASSWORD binding.

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'changeme'

test.describe('Full poll lifecycle', () => {
  let pollId: string

  // Create the test poll via the API so we don't depend on the DatePicker UI.
  test.beforeAll(async ({ request }) => {
    const login = await request.post('/api/admin/login', {
      data: { password: ADMIN_PASSWORD },
    })
    expect(login.ok(), `Admin login failed: ${await login.text()}`).toBeTruthy()

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(tomorrow)
    dayAfter.setDate(dayAfter.getDate() + 1)
    const thirdDay = new Date(dayAfter)
    thirdDay.setDate(thirdDay.getDate() + 1)

    const toDate = (d: Date) => d.toISOString().slice(0, 10)

    const create = await request.post('/api/admin/polls', {
      data: {
        title: 'E2E-Testtermin',
        description: 'Automatisierter Testlauf',
        options: [
          { label: 'Vormittag', date: toDate(tomorrow) },
          { label: 'Nachmittag', date: toDate(dayAfter) },
          { label: 'Abend', date: toDate(thirdDay) },
        ],
      },
    })
    expect(
      create.ok(),
      `Create poll failed: ${await create.text()}`,
    ).toBeTruthy()
    const poll = await create.json()
    pollId = String((poll as { id: number }).id)
  })

  test('voter submits responses and they appear in the table', async ({
    page,
  }) => {
    await page.goto(`/poll/${pollId}`)
    await expect(
      page.getByRole('heading', { name: 'E2E-Testtermin' }),
    ).toBeVisible()

    // Fill voter name
    const nameInput = page.getByPlaceholder('Dein Name')
    await nameInput.fill('Max Mustermann')

    // Select "Ja" for the first option, "Nein" for the second, "Vielleicht" for the third
    const jaButtons = page.getByRole('button', { name: 'Ja' })
    const neinButtons = page.getByRole('button', { name: 'Nein' })
    const vielleichtButtons = page.getByRole('button', { name: 'Vielleicht' })
    await jaButtons.first().click()
    await neinButtons.nth(1).click()
    await vielleichtButtons.nth(2).click()

    await page.getByRole('button', { name: 'Antworten speichern' }).click()
    await expect(page.getByText(/gespeichert/i)).toBeVisible()

    // Vote table should now include Max's name
    await expect(
      page.getByRole('columnheader', { name: 'Max Mustermann' }),
    ).toBeVisible()
  })

  test('second voter submits and both names appear in the table', async ({
    page,
  }) => {
    await page.goto(`/poll/${pollId}`)

    const nameInput = page.getByPlaceholder('Dein Name')
    await nameInput.fill('Maria Musterfrau')

    const vielleichtButtons = page.getByRole('button', { name: 'Vielleicht' })
    await vielleichtButtons.first().click()

    await page.getByRole('button', { name: 'Antworten speichern' }).click()
    await expect(page.getByText(/gespeichert/i)).toBeVisible()

    await expect(
      page.getByRole('columnheader', { name: 'Max Mustermann' }),
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: 'Maria Musterfrau' }),
    ).toBeVisible()
  })

  test('admin finalizes poll and "Termin steht fest" banner appears', async ({
    page,
    request,
  }) => {
    // Get the first option id
    const pollRes = await request.get(`/api/polls/${pollId}`)
    const poll = await pollRes.json()
    const firstOptionId = (poll as { options: { id: number }[] }).options[0]?.id

    // Finalize via API (sets final_option_id)
    const finalize = await request.patch(`/api/admin/polls/${pollId}`, {
      data: { final_option_id: firstOptionId, closed: true },
    })
    expect(finalize.ok()).toBeTruthy()

    // Poll page should show the finalized banner
    await page.goto(`/poll/${pollId}`)
    await expect(page.getByText('Termin steht fest')).toBeVisible()
  })
})
