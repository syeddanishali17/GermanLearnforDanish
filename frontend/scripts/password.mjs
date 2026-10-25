// Usage: npm run password            → generates a strong password and its hash
//        npm run password -- "mine"  → hashes your own password (12+ characters)
// Put the hash in .dev.vars (local) or `npx wrangler secret put PASSWORD_HASH` (Cloudflare).
import { webcrypto as crypto } from 'node:crypto'

const words = 'apfel berg donau fluss garten himmel insel kaffee lampe mond nebel ofen park regen sonne stern tisch wald wolke zug'.split(' ')
let pw = process.argv[2]
if (!pw) {
  const r = crypto.getRandomValues(new Uint32Array(5))
  pw = [...r].map((n, i) => (i < 4 ? words[n % words.length] : String(n % 1000).padStart(3, '0'))).join('-')
  console.log('Generated password:', pw)
} else if (pw.length < 12) {
  console.error('Use at least 12 characters.')
  process.exit(1)
}
const iterations = 20000
const salt = crypto.getRandomValues(new Uint8Array(16))
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits'])
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
const b64 = (b) => Buffer.from(b).toString('base64')
console.log('PASSWORD_HASH:', `pbkdf2$${iterations}$${b64(salt)}$${b64(bits)}`)
