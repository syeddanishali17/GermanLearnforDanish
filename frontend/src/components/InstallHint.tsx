import { useEffect, useState } from 'react'
import { isIos, isStandalone } from '../lib/platform'

const KEY = 'ustad.installHint.dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const ShareIcon = () => (
  <svg className="inline-block align-[-3px]" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
)

/**
 * "Add to Home Screen" guide. iPhone Safari has no install prompt, so we show the three taps.
 * Chrome/Android/desktop gets a real Install button via beforeinstallprompt. Hidden once installed or dismissed.
 */
export function InstallHint({ beforeLogin = false }: { beforeLogin?: boolean }) {
  const [hidden, setHidden] = useState(() => isStandalone() || dismissed())
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (hidden || (!isIos() && !prompt)) return null

  const close = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* storage unavailable */
    }
    setHidden(true)
  }

  return (
    <section className="rounded-3xl border border-ustad/30 bg-ustad-soft p-4 text-sm" aria-label="Install Ustad">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-ustad">Install Ustad on your {isIos() ? 'iPhone' : 'device'}</p>
        <button onClick={close} className="-mr-1 -mt-1 h-9 w-9 shrink-0 rounded-full text-muted" aria-label="Hide install guide">
          ✕
        </button>
      </div>
      {isIos() ? (
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>
            Tap <ShareIcon /> <span className="font-semibold">Share</span> in Safari's toolbar.
          </li>
          <li>
            Choose <span className="font-semibold">Add to Home Screen</span> (scroll down if you don't see it).
          </li>
          <li>
            Keep <span className="font-semibold">Open as Web App</span> on, then tap <span className="font-semibold">Add</span>.
          </li>
          <li>Open Ustad from the new icon{beforeLogin ? ' and log in there' : ''}.</li>
        </ol>
      ) : (
        <button onClick={() => void prompt?.prompt()} className="mt-3 min-h-11 w-full rounded-2xl bg-ustad px-4 font-semibold text-paper">
          Install
        </button>
      )}
      {beforeLogin && isIos() && <p className="mt-2 text-muted">The installed app keeps its own login, so install first, then log in.</p>}
    </section>
  )
}
