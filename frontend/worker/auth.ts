/** Single-user auth: PBKDF2 password hash in a secret, random session tokens stored hashed in D1. */

import { one, run } from './db'

export const COOKIE = 'ustad_session'
export const SESSION_DAYS = 180
const MAX_FAILURES = 5
const WINDOW_MS = 600_000

const enc = new TextEncoder()
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
}

/** Iterations stay modest: Workers Free allows ~10 ms CPU per request. The login rate limit covers online guessing. */
export async function hashPassword(password: string, iterations = 20_000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(await pbkdf2(password, salt, iterations))}`
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const [scheme, iter, salt, hash] = (stored ?? '').split('$')
  if (scheme !== 'pbkdf2' || !hash) return false
  const got = new Uint8Array(await pbkdf2(password, unb64(salt), Number(iter)))
  const want = unb64(hash)
  if (got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]
  return diff === 0
}

async function sha256(s: string): Promise<string> {
  return b64(await crypto.subtle.digest('SHA-256', enc.encode(s)))
}

export async function loginBlocked(db: D1Database, now: number): Promise<boolean> {
  await run(db, 'DELETE FROM login_failure WHERE ts < ?', now - WINDOW_MS)
  return ((await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM login_failure'))?.n ?? 0) >= MAX_FAILURES
}

export const recordFailure = (db: D1Database, now: number) => run(db, 'INSERT INTO login_failure (ts) VALUES (?)', now)
export const resetFailures = (db: D1Database) => run(db, 'DELETE FROM login_failure')

export async function createSession(db: D1Database, now: number): Promise<string> {
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!)
  await run(db, 'DELETE FROM auth_session WHERE expires_at < ?', now)
  await run(db, 'INSERT INTO auth_session (token_hash, created_at, expires_at) VALUES (?, ?, ?)', await sha256(token), now, now + SESSION_DAYS * 86_400_000)
  return token
}

export async function sessionValid(db: D1Database, token: string | undefined, now: number): Promise<boolean> {
  if (!token) return false
  const s = await one<{ expires_at: number }>(db, 'SELECT expires_at FROM auth_session WHERE token_hash = ?', await sha256(token))
  return !!s && s.expires_at > now
}

export async function dropSession(db: D1Database, token: string | undefined) {
  if (token) await run(db, 'DELETE FROM auth_session WHERE token_hash = ?', await sha256(token))
}

export function tokenMatches(expected: string | undefined, given: string | undefined): boolean {
  if (!expected || !given || expected.length !== given.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0
}

