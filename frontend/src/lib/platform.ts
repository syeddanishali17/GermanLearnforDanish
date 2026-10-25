/** Install state and platform checks for the Add to Home Screen guide. */

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS reports itself as a Mac; touch points tell them apart.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}
