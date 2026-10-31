import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function AuthPage({ mode }) {
  const isSignUp = mode === 'signup'
  const { user, status, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (status === 'checking') return <main className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">Checking your sign-in…</main>
  if (user) return <Navigate to="/dashboard" replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (isSignUp) await signUp({ displayName, email, password })
      else await signIn({ email, password })
      const destination = location.state?.from?.pathname
      navigate(destination && destination !== '/signin' && destination !== '/signup' ? destination : '/dashboard', { replace: true })
    } catch (submitError) {
      if (submitError.code === 'NETWORK_ERROR' || submitError.status >= 500) {
        setError(`${isSignUp ? 'Account creation' : 'Sign-in'} is temporarily unavailable. Please try again in a moment.`)
      } else {
        setError(submitError.message || 'We could not complete your request. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-canvas px-5 py-8 text-ink sm:place-items-center sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mx-auto flex w-fit items-center gap-3 rounded-sm focus-visible:outline-offset-4">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand text-sm font-bold text-white" aria-hidden="true">C</span>
          <span className="text-base font-semibold tracking-tight">CaptionAI</span>
        </Link>

        <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:mt-10 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Your personal workspace</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {isSignUp ? 'Save and revisit your own caption sessions.' : 'Sign in to open your sessions and dashboard.'}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {isSignUp && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Your name</span>
                <input autoComplete="name" required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
              <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
              <input type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              {isSignUp && <span className="mt-1.5 block text-xs text-subtle">Use at least 8 characters.</span>}
            </label>
            {error && <p role="alert" className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2.5 text-sm text-critical">{error}</p>}
            <button type="submit" disabled={submitting} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60">
              {submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {isSignUp ? 'Already have an account?' : 'New to CaptionAI?'}{' '}
            <Link to={isSignUp ? '/signin' : '/signup'} className="font-semibold text-brand hover:underline">{isSignUp ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </section>
        <p className="mt-5 text-center text-xs leading-5 text-subtle">Your saved sessions and transcripts are private to your account.</p>
      </div>
    </main>
  )
}
