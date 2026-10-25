/**
 * Audio for German text.
 * 1. Pre-generated natural clips in /audio (Kokoro, Thorsten voice; tools/tts/generate.py). Same on every device, offline after first play.
 * 2. Fallback: the device's speech synthesis, but only with a real German voice. Never an English voice reading German.
 *
 * iOS only allows playback that starts inside a tap, so lookup is synchronous: the manifest is loaded at startup.
 */

let clips = new Map<string, string>() // normalised text -> clip URL (public phrases)
let privateClips = new Map<string, string>() // personal phrases, served only to a logged-in session
let manifestLoaded: Promise<void> | null = null
let player: HTMLAudioElement | null = null
let stopCurrent: (() => void) | null = null

export const normalise = (text: string) => text.trim().replace(/\s+/g, ' ')

export function loadAudioManifest(): Promise<void> {
  manifestLoaded ??= fetch('/audio/manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((m: Record<string, string>) => {
      clips = new Map(Object.entries(m).map(([key, text]) => [normalise(text), `/audio/${key}.mp3`]))
    })
    .catch(() => undefined)
  return manifestLoaded
}

/** Call after login. Missing or 401 simply means no personal clips. */
export async function loadPrivateAudioManifest(): Promise<void> {
  try {
    const r = await fetch('/audio-private/manifest.json', { credentials: 'same-origin' })
    if (!r.ok) return
    const m: Record<string, string> = await r.json()
    privateClips = new Map(Object.entries(m).map(([key, text]) => [normalise(text), `/audio-private/${key}.mp3`]))
  } catch {
    /* offline or not deployed with personal content */
  }
}

export function clearPrivateAudio() {
  privateClips = new Map()
}

const clipFor = (text: string) => privateClips.get(normalise(text)) ?? clips.get(normalise(text))
export const hasClip = (text: string) => !!clipFor(text)

function germanVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  const voices = speechSynthesis.getVoices()
  const de = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('de'))
  // Prefer neural/online voices, then Austrian, then German.
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online|premium|enhanced|google/i.test(v.name) ? 10 : 0) + (v.lang.toLowerCase().includes('at') ? 2 : 0)
  return de.sort((a, b) => score(b) - score(a))[0] ?? null
}

export const speechAvailable = () => true

export function stopSpeaking() {
  stopCurrent?.()
  stopCurrent = null
}

/** Plays German text. Resolves when finished; false if no clip and no German voice on this device. */
export function speak(text: string, rate = 1): Promise<boolean> {
  stopSpeaking()
  const url = clipFor(text)
  if (url && typeof Audio !== 'undefined') {
    player ??= new Audio()
    const el = player
    el.src = url
    el.playbackRate = rate
    el.preservesPitch = true
    return new Promise((resolve) => {
      const done = (ok: boolean) => {
        el.onended = el.onerror = el.onpause = null
        resolve(ok)
      }
      el.onended = () => done(true)
      el.onerror = () => done(false)
      el.onpause = () => done(true)
      stopCurrent = () => el.pause()
      el.play().catch(() => done(false))
    })
  }
  const voice = germanVoice()
  if (!voice) return Promise.resolve(false)
  return new Promise((resolve) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/\.\.\.|…/g, ', '))
    u.voice = voice
    u.lang = voice.lang
    u.rate = rate
    u.onend = () => resolve(true)
    u.onerror = () => resolve(false)
    stopCurrent = () => speechSynthesis.cancel()
    speechSynthesis.speak(u)
  })
}

export function voiceLabel(): string {
  if (clips.size) return `Ustad voice (${clips.size + privateClips.size} recorded clips)`
  const v = germanVoice()
  return v ? `Device voice: ${v.name} (${v.lang})` : 'No German voice on this device'
}
