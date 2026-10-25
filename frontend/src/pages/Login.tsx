import { useState } from 'react'
import { InstallHint } from '../components/InstallHint'
import { Button } from '../components/ui'
import { ApiError, post } from '../lib/api'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <img src="/pwa-192.png" alt="" className="mb-6 h-16 w-16 rounded-2xl" />
      <h1 className="text-3xl font-bold tracking-tight">Ustad</h1>
      <p className="mb-8 text-muted">German for Vienna, one spoken phrase at a time.</p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            await post('/api/auth/login', { password: pw })
            onLogin()
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No connection. Try again when online.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="block text-sm font-semibold" htmlFor="pw">
          Password
        </label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          className="min-h-12 w-full rounded-2xl border border-line bg-card px-4 text-base"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        {error && <p className="text-sm text-again">{error}</p>}
        <Button className="w-full" disabled={!pw || busy}>
          {busy ? 'Checking…' : 'Log in'}
        </Button>
      </form>
      <div className="mt-8">
        <InstallHint beforeLogin />
      </div>
    </main>
  )
}
