import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell.jsx'
import { Link } from 'react-router-dom'
import { getRecentTranscripts, getSessions } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'

function StatCard({ label, value, detail, icon }) {
  const iconPaths = {
    sessions: <><rect x="3.5" y="5" width="13" height="11" rx="2" /><path d="M7 8.5h6M7 12h4" /></>,
    time: <><circle cx="10" cy="10" r="6.5" /><path d="M10 6.5V10l2.5 1.5" /></>,
    languages: <><circle cx="10" cy="10" r="6.5" /><path d="M3.8 10h12.4M10 3.5c1.7 1.8 2.5 3.9 2.5 6.5s-.8 4.7-2.5 6.5c-1.7-1.8-2.5-3.9-2.5-6.5s.8-4.7 2.5-6.5Z" /></>,
  }

  return (
    <article className="rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">{iconPaths[icon]}</svg>
        </span>
        <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-subtle">All time</span>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{label}</p>
      <p className="mt-1 text-xs text-subtle">{detail}</p>
    </article>
  )
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-meta font-semibold uppercase tracking-[0.1em] text-subtle">{eyebrow}</p>
        <h2 className="mt-1 text-section font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [recentTranscripts, setRecentTranscripts] = useState([])
  const [loading, setLoading] = useState(true)
  const [transcriptsLoading, setTranscriptsLoading] = useState(true)
  const [error, setError] = useState('')
  const [transcriptError, setTranscriptError] = useState('')

  useEffect(() => {
    let active = true
    getSessions()
      .then(({ sessions: items }) => { if (active) setSessions(items) })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    getRecentTranscripts()
      .then((items) => { if (active) setRecentTranscripts(items) })
      .catch((loadError) => { if (active) setTranscriptError(loadError.message) })
      .finally(() => { if (active) setTranscriptsLoading(false) })
    return () => { active = false }
  }, [])

  const recentSessions = useMemo(() => sessions.slice(0, 3), [sessions])
  const languageUsage = useMemo(() => {
    const counts = new Map()
    sessions.forEach(({ language }) => counts.set(language, (counts.get(language) ?? 0) + 1))
    return [...counts.entries()].map(([language, count]) => ({
      language,
      count,
      share: `${Math.round((count / (sessions.length || 1)) * 100)}%`,
    }))
  }, [sessions])
  const totalMinutes = Math.floor(sessions.reduce((total, item) => total + item.durationSeconds, 0) / 60)
  const captionTime = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const stats = [
    { label: 'Saved sessions', value: String(sessions.length), detail: 'Sessions in your library', icon: 'sessions' },
    { label: 'Caption time', value: captionTime, detail: 'Across your saved sessions', icon: 'time' },
    { label: 'Languages covered', value: String(languageUsage.length), detail: 'English, Hindi, and Telugu', icon: 'languages' },
  ]

  return (
    <AppShell>
      <div className="space-y-9">
        <section aria-labelledby="dashboard-welcome" className="relative overflow-hidden rounded-xl bg-ink px-6 py-7 text-surface shadow-sm sm:px-9 sm:py-9 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-center lg:gap-8">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-surface/20 bg-surface/10 px-3 py-1.5 text-xs font-medium text-surface/80">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
              Your workspace
            </span>
            <p className="mt-5 text-sm font-medium text-surface/70">{greeting}</p>
            <h1 id="dashboard-welcome" className="mt-1 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{greeting}, {user?.displayName?.split(' ')[0] || 'there'}.</h1>
            <p className="mt-2 max-w-2xl text-xl font-semibold tracking-tight sm:text-2xl">Make every conversation easier to follow.</p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-surface/75 sm:text-base">Turn live speech into clear captions, with multilingual support and emotional context.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/live" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-offset-4">
                Start a session
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M4 10h11M10 5l5 5-5 5" /></svg>
              </Link>
              <Link to="/history" className="inline-flex min-h-11 items-center rounded-md border border-surface/25 px-4 text-sm font-semibold text-surface transition-colors hover:bg-surface/10 focus-visible:outline-offset-4">Browse history</Link>
            </div>
          </div>
          <div aria-hidden="true" className="mt-8 hidden rounded-lg border border-surface/15 bg-surface/5 p-5 lg:block">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-surface/60">Built for live listening</p>
            <div className="mt-6 flex h-20 items-center justify-between gap-1.5">
              {[22, 38, 28, 58, 42, 74, 48, 64, 34, 52, 26, 42, 20].map((height, index) => (
                <span key={index} className="w-2 rounded-full bg-surface/80" style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-surface/15 pt-4 text-xs text-surface/70">
              <span>English</span><span>Hindi</span><span>Telugu</span>
            </div>
          </div>
        </section>

        <section aria-label="Quick statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
        </section>

        {error && <div role="alert" className="rounded-md border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical">{error}</div>}

        <section>
          <SectionHeading
            eyebrow="Your library"
            title="Recent sessions"
            action={<Link to="/history" className="rounded-md px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft focus-visible:outline-offset-2">View all sessions</Link>}
          />
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface-subtle text-meta font-medium text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3">Session</th>
                    <th scope="col" className="px-4 py-3">Language</th>
                    <th scope="col" className="px-4 py-3">Duration</th>
                    <th scope="col" className="px-4 py-3">Captions</th>
                    <th scope="col" className="px-5 py-3">Emotion summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recentSessions.map((session) => (
                    <tr key={session.id} className="transition-colors hover:bg-canvas/70">
                      <th scope="row" className="px-5 py-4 font-medium text-ink">
                        <Link to={`/history/${session.id}`} className="rounded-sm hover:text-brand focus-visible:outline-offset-2">{session.title}</Link>
                        <span className="mt-1 block text-xs font-normal text-subtle">{session.dateLabel}</span>
                      </th>
                      <td className="px-4 py-4 text-muted">{session.language}</td>
                      <td className="px-4 py-4 text-muted">{session.duration}</td>
                      <td className="px-4 py-4 text-muted">{session.captionCount}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 text-muted">
                          <span className="h-2 w-2 rounded-full bg-subtle" aria-hidden="true" />
                          {session.emotionSummary}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!loading && recentSessions.length === 0 && <tr><td colSpan="5" className="px-5 py-10 text-center text-sm text-muted">No saved sessions yet. Start one to see it here.</td></tr>}
                  {loading && <tr><td colSpan="5" className="px-5 py-10 text-center text-sm text-muted">Loading your sessions…</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-5 py-3 text-xs text-subtle">Session records are loaded from your backend database.</p>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section>
            <SectionHeading eyebrow="Activity" title="Languages used" />
            <div className="divide-y divide-line rounded-lg border border-line bg-surface px-5">
              {languageUsage.map(({ language, count, share }) => (
                <div key={language} className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">{language}</p>
                      <p className="mt-1 text-xs text-subtle">{count} {count === 1 ? 'session' : 'sessions'}</p>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-muted">{share}</span>
                  </div>
                  <div role="img" aria-label={`${share} of sessions used ${language}`} className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                    <span className="block h-full rounded-full bg-brand" style={{ width: share }} />
                  </div>
                </div>
              ))}
              {!languageUsage.length && <p className="py-4 text-sm text-muted">Language breakdown will appear after your first session.</p>}
            </div>
          </section>

          <section>
            <SectionHeading
              eyebrow="From your sessions"
              title="Recent transcript activity"
              action={<Link to="/history" className="rounded-md px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft focus-visible:outline-offset-2">View history</Link>}
            />
            <div className="rounded-lg border border-line bg-surface px-5">
              {transcriptError && <p role="alert" className="py-4 text-sm text-critical">{transcriptError}</p>}
              {!transcriptError && transcriptsLoading && <p className="py-5 text-sm text-muted">Loading transcript activity…</p>}
              {!transcriptError && !transcriptsLoading && recentTranscripts.length > 0 && (
                <ul className="divide-y divide-line">
                  {recentTranscripts.map((entry) => (
                    <li key={entry.id} className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-3 py-4">
                      <span aria-hidden="true" className="mt-2 h-2 w-2 rounded-full bg-brand" />
                      <div>
                        <p className="line-clamp-2 text-sm leading-6 text-ink">{entry.text}</p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-subtle">
                          <Link to={`/history/${entry.sessionId}`} className="font-medium text-muted hover:text-brand focus-visible:outline-offset-2">
                            {entry.sessionTitle}
                          </Link>
                          <span>{entry.language} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt))}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!transcriptError && !transcriptsLoading && recentTranscripts.length === 0 && (
                <p className="py-5 text-sm leading-6 text-muted">Saved transcript activity will appear here after a Whisper captioning session.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
