/**
 * Time helpers. Store UTC epoch milliseconds, decide "which study day is it" in Europe/Vienna.
 * A study day starts at 04:00 Vienna time (the Anki convention), so a late-night session
 * still counts for the evening it belongs to.
 */

export const TZ = 'Europe/Vienna'
const ROLLOVER_MS = 4 * 3600_000
const DAY_MS = 86_400_000

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function parts(ms: number) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second }
}

/** Offset of Vienna from UTC at this instant, in ms (e.g. +1 h in winter). */
function offset(ms: number): number {
  const p = parts(ms)
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000
}

export const now = () => Date.now()

/** YYYY-MM-DD study day for an instant. */
export function localDay(ms: number = now()): string {
  const p = parts(ms - ROLLOVER_MS)
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/** UTC ms when a study day starts (04:00 Vienna). */
export function dayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d) + ROLLOVER_MS
  let guess = wall - offset(wall)
  guess = wall - offset(guess) // second pass settles DST edges
  return guess
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10)
}

export const nextDayStart = (ms: number = now()) => dayStart(addDays(localDay(ms), 1))

/** ISO weekday 1 (Mon) .. 7 (Sun) of a study day. */
export function isoWeekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1
}

/** ISO week key "YYYY-Www" for freeze counting. */
export function isoWeek(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const thursday = new Date(date.getTime() + (4 - isoWeekday(day)) * DAY_MS)
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7)
  return `${thursday.getUTCFullYear()}-W${week}`
}
