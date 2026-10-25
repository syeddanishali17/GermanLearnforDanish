/** Tiny helpers over the D1 binding. */

export interface Env {
  DB: D1Database
  ASSETS?: Fetcher
  /** pbkdf2$<iterations>$<salt b64>$<hash b64>, set with `npm run password` */
  PASSWORD_HASH?: string
  /** Read-only token for GET /api/stats/gate */
  GATE_TOKEN?: string
  /** "false" only for local http dev */
  COOKIE_SECURE?: string
}

type Param = string | number | null

export async function all<T>(db: D1Database, sql: string, ...params: Param[]): Promise<T[]> {
  const r = await db.prepare(sql).bind(...params).all<T>()
  return r.results ?? []
}

export async function one<T>(db: D1Database, sql: string, ...params: Param[]): Promise<T | null> {
  return (await db.prepare(sql).bind(...params).first<T>()) ?? null
}

export async function run(db: D1Database, sql: string, ...params: Param[]): Promise<{ id: number; changes: number }> {
  const r = await db.prepare(sql).bind(...params).run()
  return { id: Number(r.meta.last_row_id), changes: Number(r.meta.changes) }
}

export const bool = (v: unknown) => v === 1 || v === true
