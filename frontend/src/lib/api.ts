/** Same-origin API client. In dev Vite proxies /api; in prod a Cloudflare Pages Function does (spec §8.1). */

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      msg = (await res.json()).detail ?? msg
    } catch {
      /* not JSON */
    }
    if (res.status === 401) window.dispatchEvent(new Event('ustad:logged-out'))
    throw new ApiError(res.status, typeof msg === 'string' ? msg : 'Request failed')
  }
  return res.json() as Promise<T>
}

export const post = <T>(path: string, json: unknown) => api<T>(path, { method: 'POST', json })
