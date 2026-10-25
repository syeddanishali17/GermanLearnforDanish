/** In-memory D1 stand-in on node:sqlite, plus a logged-in request helper for the Hono app. */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { hashPassword } from '../auth'
import type { Env } from '../db'
import { handle } from '../index'

export const TEST_PASSWORD = 'test-password-123'

type Param = string | number | null

function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  const dir = join(__dirname, '..', '..', 'migrations')
  for (const f of readdirSync(dir).sort()) db.exec(readFileSync(join(dir, f), 'utf8'))
  const prepare = (sql: string) => {
    let params: Param[] = []
    const stmt = {
      bind(...p: Param[]) {
        params = p.map((v) => (v === undefined ? null : v))
        return stmt
      },
      async first(col?: string) {
        const r = db.prepare(sql).get(...params) as Record<string, unknown> | undefined
        return r ? (col ? r[col] : { ...r }) : null
      },
      async all() {
        return { results: db.prepare(sql).all(...params).map((r) => ({ ...(r as object) })), success: true, meta: {} }
      },
      async run() {
        const r = db.prepare(sql).run(...params)
        return { results: [], success: true, meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }
      },
    }
    return stmt
  }
  return { prepare } as unknown as D1Database
}

export async function makeEnv(): Promise<Env> {
  return { DB: makeD1(), PASSWORD_HASH: await hashPassword(TEST_PASSWORD, 1000), GATE_TOKEN: 'gate-test-token', COOKIE_SECURE: 'false' }
}

export interface Client {
  env: Env
  req: (path: string, init?: { method?: string; json?: unknown; headers?: Record<string, string> }) => Promise<Response>
  get: <T = any>(path: string) => Promise<T> // eslint-disable-line @typescript-eslint/no-explicit-any
  post: <T = any>(path: string, json?: unknown) => Promise<T> // eslint-disable-line @typescript-eslint/no-explicit-any
  login: () => Promise<void>
}

export async function client(): Promise<Client> {
  const env = await makeEnv()
  let cookie = ''
  const req: Client['req'] = async (path, init = {}) => {
    const headers: Record<string, string> = { ...(init.headers ?? {}) }
    if (cookie) headers.cookie = cookie
    if (init.json !== undefined) headers['content-type'] = 'application/json'
    const res = await handle(
      new Request(`http://localhost${path}`, { method: init.method ?? 'GET', headers, body: init.json !== undefined ? JSON.stringify(init.json) : undefined }),
      env,
    )
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0]
    return res
  }
  return {
    env,
    req,
    get: async (path) => (await req(path)).json(),
    post: async (path, json = {}) => (await req(path, { method: 'POST', json })).json(),
    login: async () => {
      const r = await req('/api/auth/login', { method: 'POST', json: { password: TEST_PASSWORD } })
      if (r.status !== 200) throw new Error(`login failed ${r.status}`)
    },
  }
}
