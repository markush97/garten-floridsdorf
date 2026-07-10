/**
 * Outbound e-mail via the Resend HTTP API — the only thing we send
 * is the magic sign-in link. When `RESEND_API_KEY` is not
 * configured (local dev), the mail is skipped and the link is
 * logged to the worker console instead so the flow stays testable.
 */

export type EmailEnv = {
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
}

const DEFAULT_FROM = 'SV Beet & Bewegung <anmeldung@garten-floridsdorf.at>'

export async function sendMagicLinkEmail(
  env: EmailEnv,
  to: string,
  url: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email] RESEND_API_KEY not set — magic link for ${to}: ${url}`)
    return
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM ?? DEFAULT_FROM,
      to: [to],
      subject: 'Dein Anmeldelink – SV Beet & Bewegung',
      text: [
        'Hallo!',
        '',
        'Mit diesem Link meldest du dich beim internen Bereich an:',
        url,
        '',
        'Der Link ist 15 Minuten gültig und funktioniert nur einmal.',
        'Wenn du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.',
      ].join('\n'),
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Resend returned ${response.status}: ${detail}`)
  }
}
