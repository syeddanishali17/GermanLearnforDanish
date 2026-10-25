import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { startActivity } from './lib/activity'
import { api, ApiError } from './lib/api'
import { flush } from './lib/outbox'
import { loadPrivateAudioManifest } from './lib/speech'
import Bahar from './pages/Bahar'
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
  { to: '/talk', label: 'Talk', icon: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12ZM8.5 12h.01M12 12h.01M15.5 12h.01" /> },
  { to: '/culture', label: 'Vienna', icon: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-8 10h16M12 2c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.2-4-10s1.5-7.3 4-10Z" /> },
  { to: '/bahar', label: 'Mission', icon: <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /> },
  { to: '/more', label: 'More', icon: <path d="M4 6h16M4 12h16M4 18h16" /> },
]

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <main className="px-4 pt-[max(env(safe-area-inset-top),12px)] pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-ustad' : 'text-muted'}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {n.icon}
              </svg>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
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
  if (me.isPending) return <p className="pt-20 text-center text-muted">Loading…</p>
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
