/**
 * Outbound e-mail via our self-hosted SMTP relay. Workers can't open
 * raw TCP, so the Worker POSTs a small JSON envelope to an HTTP
 * bridge running on the mailserver, which translates it into SMTP.
 * The bridge contract is documented in `docs/smtp-relay.md`.
 *
 * When `SMTP_RELAY_URL` is missing (e.g. local dev without the
 * relay), the mail is logged to the worker console instead so the
 * flows stay testable.
 */

const DEFAULT_FROM = 'SV Beet & Bewegung <anmeldung@beetbewegung.at>'

export type EmailEnv = {
  SMTP_RELAY_URL?: string
  SMTP_RELAY_TOKEN?: string
  EMAIL_FROM?: string
}

function fromAddress(env: EmailEnv): string {
  return env.EMAIL_FROM ?? DEFAULT_FROM
}

export type RelayErrorCode =
  | 'UNAUTHORIZED'
  | 'BAD_REQUEST'
  | 'UPSTREAM_FAILURE'
  | 'UNKNOWN'

function classifyRelayError(status: number): RelayErrorCode {
  if (status === 401 || status === 403) return 'UNAUTHORIZED'
  if (status === 400 || status === 422) return 'BAD_REQUEST'
  if (status >= 500 && status < 600) return 'UPSTREAM_FAILURE'
  return 'UNKNOWN'
}

export async function sendEmail(
  env: EmailEnv,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  if (!env.SMTP_RELAY_URL) {
    console.log(
      `[email] SMTP_RELAY_URL not set — mail to ${to} skipped.\nSubject: ${subject}\n${text}`,
    )
    return
  }
  const response = await fetch(
    `${env.SMTP_RELAY_URL.replace(/\/$/, '')}/send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.SMTP_RELAY_TOKEN
          ? { 'X-SMTP-Token': env.SMTP_RELAY_TOKEN }
          : {}),
      },
      body: JSON.stringify({
        from: fromAddress(env),
        to,
        subject,
        text,
      }),
    },
  )
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `SMTP relay returned ${response.status} (${classifyRelayError(response.status)}): ${detail}`,
    )
  }
}

export async function sendMagicLinkEmail(
  env: EmailEnv,
  to: string,
  url: string,
): Promise<void> {
  await sendEmail(
    env,
    to,
    'Dein Anmeldelink – SV Beet & Bewegung',
    [
      'Hallo!',
      '',
      'Mit diesem Link meldest du dich beim internen Bereich an:',
      url,
      '',
      'Der Link ist 15 Minuten gültig und funktioniert nur einmal.',
      'Wenn du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.',
    ].join('\n'),
  )
}
