/**
 * Offline outbox for answers (spec §8.2). Each entry carries a client UUID and timestamp;
 * the server applies them in timestamp order and ignores UUIDs it has already seen.
 */
import { ApiError, post } from './api'

const KEY = 'ustad.outbox.v1'

export interface OutboxEntry {
  path: string
  body: Record<string, unknown>
}

function read(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function write(entries: OutboxEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    /* storage unavailable: answers stay in memory only */
  }
}

export function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** Drops queued answers (after a final send attempt). Used on logout. */
export function clearOutbox() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

export function pendingCount(): number {
  return read().length
}

let flushing: Promise<void> | null = null

export function flush(): Promise<void> {
  if (flushing) return flushing
  flushing = (async () => {
    let entries = read()
    // Review answers go as one batch so the server can sort them by time.
    const answers = entries.filter((e) => e.path === '/api/review/answers')
    if (answers.length) {
      try {
        await post('/api/review/answers', answers.map((a) => a.body))
        entries = read().filter((e) => !answers.some((a) => a.body.uuid === e.body.uuid))
        write(entries)
      } catch (e) {
        if (!(e instanceof ApiError) || e.status === 401 || e.status >= 500) return
        // 4xx: drop malformed entries rather than retrying forever
        const sent = new Set(answers.map((a) => a.body.uuid))
        write(read().filter((x) => !sent.has(x.body.uuid)))
      }
    }
    for (const e of read().filter((x) => x.path !== '/api/review/answers')) {
      try {
        await post(e.path, e.body)
      } catch (err) {
        if (!(err instanceof ApiError) || err.status === 401 || err.status >= 500) return
      }
      write(read().filter((x) => x.body.uuid !== e.body.uuid))
    }
  })().finally(() => {
    flushing = null
  })
  return flushing
}

/** Queue an entry, then try to send everything. Never throws: offline answers wait for the next flush. */
export async function send(path: string, body: Record<string, unknown>): Promise<void> {
  const entry = { path, body: { uuid: uuid(), ts: new Date().toISOString(), ...body } }
  write([...read(), entry])
  await flush().catch(() => undefined)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush())
}
