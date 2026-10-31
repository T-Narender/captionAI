import { useState } from 'react'
import AppShell from '../components/layout/AppShell.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Profile() {
  const { user, updateProfile } = useAuth()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    setSaving(true)
    try {
      const updated = await updateProfile({ displayName })
      setDisplayName(updated.displayName)
      setMessage('Your profile has been updated.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-7">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Your profile</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Manage the name shown in your CaptionAI workspace.</p>
        </header>

        <section className="rounded-xl border border-line bg-surface p-5 sm:p-7">
          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Display name</span>
              <input value={displayName} maxLength={80} required onChange={(event) => setDisplayName(event.target.value)} className="min-h-11 w-full max-w-lg rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            </label>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Email</p>
              <p className="text-sm text-muted">{user.email}</p>
              <p className="mt-1 text-xs text-subtle">Email changes are not available yet.</p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Account created</p>
              <p className="text-sm text-muted">{new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(user.createdAt))}</p>
            </div>
            {message && <p role="status" className="text-sm text-positive">{message}</p>}
            {error && <p role="alert" className="text-sm text-critical">{error}</p>}
            <button disabled={saving} type="submit" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : 'Save profile'}</button>
          </form>
        </section>
      </div>
    </AppShell>
  )
}
