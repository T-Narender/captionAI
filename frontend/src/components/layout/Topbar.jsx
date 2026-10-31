import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Topbar({ onMenuClick, menuButtonRef, navigationOpen }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const pageTitle = pathname.startsWith('/history/')
    ? 'Session details'
    : {
      '/dashboard': 'Overview',
      '/live': 'Live session',
      '/history': 'Session history',
      '/settings': 'Settings',
    }[pathname] ?? 'Workspace'

  return (
    <header aria-label="Page header" className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-5 sm:px-8">
      <div className="flex items-center gap-3">
        <button
          ref={menuButtonRef}
          type="button"
          className="grid h-9 w-9 place-items-center rounded-md border border-line text-muted hover:bg-surface-subtle focus-visible:outline-offset-2 md:hidden"
          aria-label="Open navigation menu"
          aria-controls="primary-navigation"
          aria-expanded={navigationOpen}
          onClick={onMenuClick}
        >
          <span aria-hidden="true" className="flex w-4 flex-col gap-1">
            <span className="h-0.5 w-full bg-current" />
            <span className="h-0.5 w-full bg-current" />
            <span className="h-0.5 w-full bg-current" />
          </span>
        </button>
        <p className="text-sm font-semibold text-ink">{pageTitle}</p>
      </div>
      {pathname !== '/live' && (
        <Link
          to="/live"
          className="inline-flex min-h-10 items-center rounded-md bg-brand px-4 text-sm font-semibold text-surface hover:bg-brand-hover focus-visible:outline-offset-4"
        >
          Start a session
        </Link>
      )}
      <div className="ml-3 flex items-center gap-3 border-l border-line pl-3 sm:pl-4">
        <Link to="/profile" className="hidden max-w-40 truncate text-sm font-medium text-muted hover:text-ink sm:block" title={user?.displayName}>
          {user?.displayName}
        </Link>
        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true)
            try { await signOut() } finally { navigate('/signin', { replace: true }) }
          }}
          className="min-h-9 rounded-md border border-line px-3 text-sm font-semibold text-muted hover:bg-surface-subtle hover:text-ink disabled:opacity-60"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </header>
  )
}
