import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from './components/Loading'
import { startActivity } from './lib/activity'
import { api, ApiError } from './lib/api'
import { flush } from './lib/outbox'
import { loadPrivateAudioManifest } from './lib/speech'
import Bahar from './pages/Bahar'
import { CourseOverview, GrammarPage, WeekPage } from './pages/Course'
import { Culture, ItemPage } from './pages/Culture'
import Login from './pages/Login'
import Manzil from './pages/Manzil'
import More from './pages/More'
import { Bolna, Sabqi } from './pages/Practice'
import Sabaq from './pages/Sabaq'
import { ConversationPage, TalkList } from './pages/Talk'
import Today from './pages/Today'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2, refetchOnWindowFocus: true } },
})

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Today', icon: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" /> },
  { to: '/kurs', label: 'Kurs', icon: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M8 7h8M8 11h6" /> },
  { to: '/talk', label: 'Talk', icon: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12ZM8.5 12h.01M12 12h.01M15.5 12h.01" /> },
  { to: '/bahar', label: 'Mission', icon: <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /> },
  { to: '/more', label: 'More', icon: <path d="M4 6h16M4 12h16M4 18h16" /> },
]

/** Lesson screens hide the tab bar: fewer accidental taps, more room, clear "you are in a session" feeling. */
const FOCUS = [/^\/manzil/, /^\/sabaq/, /^\/sabqi/, /^\/bolna/, /^\/talk\/.+/, /^\/grammar\/.+/]
const isFocusRoute = (path: string) => FOCUS.some((r) => r.test(path))

function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const focus = isFocusRoute(pathname)
  useEffect(() => {
    // Block body: in newer Chrome scrollTo returns a promise, which must not be returned from an effect.
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="mx-auto min-h-dvh max-w-md" data-focus={focus || undefined}>
      <main className={`px-4 pt-[max(env(safe-area-inset-top),12px)] ${focus ? 'pb-[max(env(safe-area-inset-bottom),24px)]' : 'pb-28'}`}>{children}</main>
      {!focus && (
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
          <div className="mx-auto grid max-w-md grid-cols-5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-ustad' : 'text-muted'}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {n.icon}
                </svg>
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

function Authed() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api('/api/auth/me'), retry: false, staleTime: Infinity })

  useEffect(() => {
    const out = () => queryClient.setQueryData(['me'], null)
    window.addEventListener('ustad:logged-out', out)
    startActivity()
    void flush().catch(() => undefined)
    return () => window.removeEventListener('ustad:logged-out', out)
  }, [])

  useEffect(() => {
    if (me.data) void loadPrivateAudioManifest()
  }, [me.data])

  const login = () => {
    queryClient.clear()
    void me.refetch()
  }
  if (me.isPending) return <Loading />
  // Offline with an earlier session: show the app from cache rather than the login screen.
  const offline = me.isError && !(me.error instanceof ApiError)
  if (!me.data && !offline) return <Login onLogin={login} />

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/manzil" element={<Manzil />} />
        <Route path="/sabqi" element={<Sabqi />} />
        <Route path="/sabaq" element={<Sabaq />} />
        <Route path="/bolna" element={<Bolna />} />
        <Route path="/bahar" element={<Bahar />} />
        <Route path="/kurs" element={<CourseOverview />} />
        <Route path="/kurs/:week" element={<WeekPage />} />
        <Route path="/grammar/:code" element={<GrammarPage />} />
        <Route path="/talk" element={<TalkList />} />
        <Route path="/talk/:slug" element={<ConversationPage />} />
        <Route path="/culture" element={<Culture />} />
        <Route path="/item/:id" element={<ItemPage />} />
        <Route
          path="/more"
          element={
            <More
              onLogout={() => {
                queryClient.clear()
                queryClient.setQueryData(['me'], null)
              }}
            />
          }
        />
        <Route path="*" element={<Today />} />
      </Routes>
    </Shell>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Authed />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
