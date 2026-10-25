/** Logout: end the server session, then remove private data kept on this device. */
import { post } from './api'
import { clearOutbox, flush } from './outbox'
import { clearPrivateAudio } from './speech'

const PRIVATE_CACHES = ['ustad-api', 'ustad-audio-private']

export async function logoutAndClear(): Promise<void> {
  // Send unsynced answers first so logging out never loses study work.
  await flush().catch(() => undefined)
  await post('/api/auth/logout', {}).catch(() => undefined)
  clearOutbox()
  clearPrivateAudio()
  try {
    sessionStorage.clear()
  } catch {
    /* storage unavailable */
  }
  if (typeof caches !== 'undefined') await Promise.all(PRIVATE_CACHES.map((c) => caches.delete(c).catch(() => false)))
}
