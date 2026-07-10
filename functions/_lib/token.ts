/**
 * Opaque bearer-token helpers shared by share links, invites and
 * magic sign-in links.
 *
 * A token is 32 random bytes, base64url-encoded (43 chars, no
 * padding). We hash it with SHA-256 and store only the hex hash on
 * the server; the plaintext is only ever embedded in the link we
 * hand out, so a database leak doesn't expose live links.
 */

export function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

export async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return bytesToHex(new Uint8Array(digest))
}

/**
 * Validates the shape of a token before hashing: base64url alphabet
 * only, no padding, within the length band we generate. Rejecting
 * everything else keeps crafted strings out of hash lookups and
 * makes the value safe to embed in a URL path without escaping.
 */
export function isValidTokenShape(value: string): boolean {
  if (value.length < 32 || value.length > 128) return false
  return /^[A-Za-z0-9_-]+$/.test(value)
}

/**
 * Short, non-secret prefix for the admin UI so a person can tell
 * two tokens apart ("the 8f3a… one") without seeing the secret.
 */
export function tokenFingerprint(token: string): string {
  return token.slice(0, 8)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] as number)
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    out += (bytes[i] as number).toString(16).padStart(2, '0')
  }
  return out
}
