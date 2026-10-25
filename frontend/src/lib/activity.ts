/**
 * Active-time tracker (spec §7): counts seconds only while the page is visible and the
 * last interaction was under 60 s ago. Speaking/Manzil seconds are counted while that mode is set.
 */
import { useEffect } from 'react'
import { send } from './outbox'

type Mode = 'speaking' | 'manzil' | null
const IDLE_S = 60
const FLUSH_EVERY_S = 30

let last = Date.now()
let mode: Mode = null
const acc = { active_s: 0, speaking_s: 0, manzil_s: 0 }
let ticks = 0
let started = false

function poke() {
  last = Date.now()
}

export function flushActivity(extra: Record<string, unknown> = {}) {
  const body = { ...acc, ...extra }
  acc.active_s = acc.speaking_s = acc.manzil_s = 0
  if (body.active_s || body.speaking_s || body.manzil_s || Object.keys(extra).length) void send('/api/activity', body)
}

export function startActivity() {
  if (started || typeof window === 'undefined') return
  started = true
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, poke, { passive: true })
  setInterval(() => {
    if (document.visibilityState !== 'visible' || Date.now() - last > IDLE_S * 1000) return
    acc.active_s++
    if (mode === 'speaking') acc.speaking_s++
    if (mode === 'manzil') acc.manzil_s++
    if (++ticks % FLUSH_EVERY_S === 0) flushActivity()
  }, 1000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushActivity())
}

/** Set the counting mode while a screen is mounted. */
export function useActivityMode(m: Mode) {
  useEffect(() => {
    mode = m
    return () => {
      mode = null
      flushActivity()
    }
  }, [m])
}
