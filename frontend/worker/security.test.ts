// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { handle } from './index'
import { client, makeEnv, TEST_PASSWORD } from './test/helpers'

/** Every route that returns personal data or changes it. Must all be 401 without a session. */
const PRIVATE: [string, string][] = [
  ['GET', '/api/auth/me'],
  ['GET', '/api/daily'],
  ['GET', '/api/review/queue'],
  ['POST', '/api/review/answers'],
  ['POST', '/api/sabaq/introduce'],
  ['POST', '/api/activity'],
  ['GET', '/api/items'],
  ['GET', '/api/items/hallo'],
  ['POST', '/api/items/hallo/report'],
  ['GET', '/api/culture'],
  ['GET', '/api/missions'],
  ['POST', '/api/missions'],
  ['PATCH', '/api/missions/1'],
  ['GET', '/api/conversations'],
  ['GET', '/api/conversations/a1-mensa-platz'],
  ['POST', '/api/conversations/a1-mensa-platz/practice'],
  ['GET', '/api/stats/dashboard'],
  ['GET', '/api/stats/gate'],
  ['GET', '/api/settings'],
  ['PUT', '/api/settings'],
  ['GET', '/api/export'],
]

describe('security', () => {
  it.each(PRIVATE)('%s %s rejects unauthenticated requests', async (method, path) => {
    const c = await client()
    const res = await c.req(path, { method, json: method === 'GET' ? undefined : {} })
    expect(res.status).toBe(401)
  })

  it('a wrong gate token does not open private data', async () => {
    const c = await client()
    expect((await c.req('/api/export', { headers: { 'x-gate-token': 'gate-test-token' } })).status).toBe(401)
    expect((await c.req('/api/stats/gate', { headers: { 'x-gate-token': 'wrong' } })).status).toBe(401)
  })

  it('API responses carry security headers, no CORS, no caching', async () => {
    const c = await client()
    for (const path of ['/api/health', '/api/daily', '/sitemap.xml']) {
      const res = await c.req(path)
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('referrer-policy')).toBe('no-referrer')
      expect(res.headers.get('x-frame-options')).toBe('DENY')
      expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
      expect(res.headers.get('permissions-policy')).toBe('camera=(), geolocation=(), payment=(), microphone=(self)')
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    }
    expect((await c.req('/api/daily')).headers.get('cache-control')).toBe('private, no-store')
    expect((await c.req('/sitemap.xml')).status).toBe(404)
  })

  it('session cookie is HttpOnly, Secure, SameSite=Strict with an expiry', async () => {
    const env = { ...(await makeEnv()), COOKIE_SECURE: undefined }
    const res = await handle(
      new Request('https://ustad.example/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: TEST_PASSWORD }) }),
      env,
    )
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(res.status).toBe(200)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/Secure/i)
    expect(cookie).toMatch(/SameSite=Strict/i)
    expect(cookie).toMatch(/Max-Age=15552000/)
    expect(await res.text()).not.toContain(cookie.split(';')[0].split('=')[1]) // token never in the body
  })

  it('logout invalidates the session server-side', async () => {
    const env = (await client()).env
    // Capture the cookie, log out, then replay the old cookie: must be rejected.
    const login = await handle(
      new Request('http://localhost/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: TEST_PASSWORD }) }),
      env,
    )
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
    expect((await handle(new Request('http://localhost/api/daily', { headers: { cookie } }), env)).status).toBe(200)
    await handle(new Request('http://localhost/api/auth/logout', { method: 'POST', headers: { cookie } }), env)
    expect((await handle(new Request('http://localhost/api/daily', { headers: { cookie } }), env)).status).toBe(401)
  })

  it('personal audio needs a session', async () => {
    const c = await client()
    c.env.ASSETS = { fetch: async () => new Response('mp3', { headers: { 'content-type': 'audio/mpeg' } }) } as unknown as Fetcher
    expect((await c.req('/audio-private/manifest.json')).status).toBe(401)
    expect((await c.req('/audio-private/abc.mp3')).status).toBe(401)
    await c.login()
    const ok = await c.req('/audio-private/abc.mp3')
    expect(ok.status).toBe(200)
    expect(ok.headers.get('cache-control')).toBe('private, max-age=604800')
    expect(ok.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    c.env.ASSETS = { fetch: async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }) } as unknown as Fetcher
    expect((await c.req('/audio-private/missing.mp3')).status).toBe(404)
  })

  it('blocks cross-site writes even with a valid session', async () => {
    const c = await client()
    await c.login()
    const res = await c.req('/api/missions', { method: 'POST', json: { text: 'x' }, headers: { origin: 'https://evil.example' } })
    expect(res.status).toBe(403)
    const res2 = await c.req('/api/missions', { method: 'POST', json: { text: 'x' }, headers: { 'sec-fetch-site': 'cross-site' } })
    expect(res2.status).toBe(403)
    const ok = await c.req('/api/missions', { method: 'POST', json: { text: 'Hallo' }, headers: { origin: 'http://localhost' } })
    expect(ok.status).toBe(200)
  })
})
