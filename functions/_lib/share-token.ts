/**
 * Helpers for the pre-meeting share-link feature.
 *
 * The token is 32 random bytes, base64url-encoded (43 chars, no
 * padding). We hash it with SHA-256 and store only the hex hash on
 * the server; the plaintext is only ever returned once on creation.
 *
 * Cloudflare Workers expose the standard Web Crypto API — we use
 * `crypto.subtle.digest` for hashing and `crypto.getRandomValues`
 * for the random bytes. This keeps us portable with Node's web
 * crypto as well.
 */

/**
 * Generates a fresh share token. Returns a 43-character
 * base64url string (32 random bytes, no padding) that the admin
 * should embed in the share URL.
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

/**
 * Hashes the plaintext token with SHA-256 and returns a 64-char
 * hex string. The server only ever persists this value.
 */
export async function hashShareToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return bytesToHex(new Uint8Array(digest))
}

/**
 * Validates the shape of a token: it must be base64url alphabet
 * only, with no padding (`=`), and be at least 32 chars (the
 * minimum we generate).
 *
 * We also reject characters that have any path-traversal meaning
 * (slash, backslash, dot, percent) so the value is safe to embed
 * in a URL path or query without further escaping.
 */
export function isValidShareTokenShape(value: string): boolean {
  if (value.length < 32 || value.length > 128) return false
  return /^[A-Za-z0-9_-]+$/.test(value)
}

/**
 * Returns a short, non-secret fingerprint for the admin UI: the
 * first 8 chars of the token. This is enough for a person to
 * tell two tokens apart ("the 8f3a… one") without revealing
 * the secret.
 */
export function shareTokenFingerprint(token: string): string {
  return token.slice(0, 8)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] as number)
  }
  // btoa is available in both Workers and modern Node; we still
  // escape non-Latin1 input safely here.
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
