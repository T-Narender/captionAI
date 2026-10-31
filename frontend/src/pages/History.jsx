import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/layout/AppShell.jsx'
import SearchBar from '../components/common/SearchBar.jsx'
import FilterBar from '../components/common/FilterBar.jsx'
import { deleteSession, getSessions } from '../utils/api.js'

function SessionRow({ session, onDelete, deleting }) {
  return (
    <li className="grid gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(12rem,1.6fr)_0.8fr_0.8fr_0.7fr_1fr_auto] sm:items-center sm:gap-3 sm:px-6">
      <div className="min-w-0">
        <Link to={`/history/${session.id}`} className="rounded-sm text-sm font-semibold text-ink hover:text-brand focus-visible:outline-offset-2">{session.title}</Link>
        <p className="mt-1 text-xs text-subtle">{session.dateLabel}</p>
      </div>
      <div className="flex justify-between gap-3 sm:block">
        <span className="text-xs text-subtle sm:hidden">Language</span>
        <span className="text-sm text-muted">{session.language}</span>
      </div>
      <div className="flex justify-between gap-3 sm:block">
        <span className="text-xs text-subtle sm:hidden">Duration</span>
        <span className="text-sm text-muted">{session.duration}</span>
      </div>
      <div className="flex justify-between gap-3 sm:block">
        <span className="text-xs text-subtle sm:hidden">Captions</span>
        <span className="text-sm tabular-nums text-muted">{session.captionCount}</span>
      </div>
      <div className="flex justify-between gap-3 sm:block">
        <span className="text-xs text-subtle sm:hidden">Emotion summary</span>
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <span className="h-2 w-2 rounded-full bg-subtle" aria-hidden="true" />
          {session.emotionSummary}
        </span>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <Link to={`/history/${session.id}`} className="inline-flex min-h-9 items-center justify-center rounded-md border border-line px-3 text-xs font-semibold text-ink hover:bg-surface-subtle focus-visible:outline-offset-2">
          View
        </Link>
        <button
          type="button"
          disabled={deleting || session.status !== 'completed'}
          aria-label={`Delete ${session.title}`}
          title={session.status !== 'completed' ? 'Stop the live session before deleting it' : 'Delete session and transcript'}
          onClick={() => onDelete(session)}
          className="inline-flex min-h-9 items-center justify-center rounded-md border border-critical/30 px-3 text-xs font-semibold text-critical hover:bg-critical-soft focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {session.status !== 'completed' ? 'Active' : deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </li>
  )
}

const PAGE_SIZE = 10
const languageCodes = { English: 'en', Hindi: 'hi', Telugu: 'te' }

export default function History() {
  const [sessions, setSessions] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('all')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  const [deletingSessionId, setDeletingSessionId] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      getSessions({
        search: query.trim(),
        language: languageCodes[language] ?? '',
        date,
        page,
        limit: PAGE_SIZE,
      })
        .then((result) => {
          if (!active) return
          setSessions(result.sessions)
          setPagination(result.pagination)
        })
        .catch((loadError) => {
          if (!active) return
          setError(loadError.message)
          setSessions([])
          setPagination({ page, limit: PAGE_SIZE, total: 0, pages: 0 })
        })
        .finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query, language, date, page])

  const hasFilters = Boolean(query.trim() || language !== 'all' || date)
  const firstResult = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const lastResult = Math.min(pagination.page * pagination.limit, pagination.total)

  function clearFilters() {
    setQuery('')
    setLanguage('all')
    setDate('')
    setPage(1)
  }

  async function handleDelete(session) {
    const confirmed = window.confirm(`Delete “${session.title}” and its saved transcript? This cannot be undone.`)
    if (!confirmed) return
    setDeletingSessionId(session.id)
    setError('')
    try {
      await deleteSession(session.id)
      setSessions((current) => current.filter((item) => item.id !== session.id))
      setPagination((current) => {
        const total = Math.max(0, current.total - 1)
        return { ...current, total, pages: Math.ceil(total / current.limit) }
      })
      if (sessions.length === 1 && page > 1) setPage((current) => current - 1)
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this session. Please try again.')
    } finally {
      setDeletingSessionId('')
    }
  }

  return (
    <AppShell>
      <div className="space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-meta font-semibold uppercase tracking-[0.1em] text-brand">Your library</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Session history</h1>
            <p className="mt-2 text-sm text-muted">Find and revisit your previous captioning sessions.</p>
          </div>
          <Link to="/live" className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-surface hover:bg-brand-hover focus-visible:outline-offset-4">Start new session</Link>
        </header>

        <section aria-label="Search and filter sessions" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-5">
          <SearchBar value={query} onChange={(value) => { setQuery(value); setPage(1) }} />
          <FilterBar
            language={language}
            onLanguageChange={(value) => { setLanguage(value); setPage(1) }}
            date={date}
            onDateChange={(value) => { setDate(value); setPage(1) }}
            onClear={clearFilters}
          />
        </section>

        <section aria-labelledby="session-list-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="session-list-heading" className="text-sm font-semibold text-ink">All sessions</h2>
            <p className="text-xs text-muted" aria-live="polite">{pagination.total} {pagination.total === 1 ? 'session' : 'sessions'}</p>
          </div>
          {error && <div role="alert" className="mb-3 rounded-md border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical">{error}</div>}
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className="hidden grid-cols-[minmax(12rem,1.6fr)_0.8fr_0.8fr_0.7fr_1fr_auto] gap-3 border-b border-line bg-surface-subtle px-6 py-3 text-xs font-medium text-muted sm:grid">
              <span>Session</span><span>Language</span><span>Duration</span><span>Captions</span><span>Emotion summary</span><span className="sr-only">Actions</span>
            </div>
            {loading ? (
              <p className="px-6 py-12 text-center text-sm text-muted">Loading sessions…</p>
            ) : sessions.length ? (
              <ul aria-label="Captioning sessions">
                {sessions.map((session) => <SessionRow key={session.id} session={session} onDelete={handleDelete} deleting={deletingSessionId === session.id} />)}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center">
                <h3 className="text-sm font-semibold text-ink">{hasFilters ? 'No matching sessions' : 'No sessions yet'}</h3>
                <p className="mt-2 text-sm text-muted">{hasFilters ? 'Try another search or clear your filters.' : 'Start a live session and it will appear here.'}</p>
                {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-md px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft focus-visible:outline-offset-2">Clear filters</button>}
              </div>
            )}
            <p className="border-t border-line px-5 py-3 text-xs text-subtle">Session records are loaded from your backend database.</p>
          </div>
          {!loading && !error && pagination.pages > 1 && (
            <nav aria-label="Session history pages" className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-muted">Showing {firstResult}–{lastResult} of {pagination.total} sessions</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="min-h-10 rounded-md border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-offset-2"
                >
                  Previous
                </button>
                <span className="min-w-20 text-center text-sm tabular-nums text-muted">Page {pagination.page} of {pagination.pages}</span>
                <button
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
                  className="min-h-10 rounded-md border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-offset-2"
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </section>
      </div>
    </AppShell>
  )
}

