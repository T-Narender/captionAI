import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../components/layout/AppShell.jsx'
import { getSession, updateSessionTitle } from '../utils/api.js'
import { readPreferences } from '../utils/preferences.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getEmotionPresentation } from '../utils/emotionDisplay.js'

const emotionStyle = {
  neutral: 'bg-surface-subtle text-muted',
  happy: 'bg-positive-soft text-positive',
  sad: 'bg-brand-soft text-brand',
  angry: 'bg-critical-soft text-critical',
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}

function formatProvider(provider) {
  return {
    groq: 'Groq Whisper',
    'local-whisper': 'Local Whisper',
    'local-whisper-fallback': 'Local Whisper fallback',
  }[provider] ?? 'Provider not recorded'
}

function formatSrtTime(seconds) {
  const milliseconds = Math.max(0, Math.floor((Number(seconds) || 0) * 1000))
  const hours = Math.floor(milliseconds / 3_600_000)
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000)
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000)
  const remainder = milliseconds % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')},${String(remainder).padStart(3, '0')}`
}

function downloadTranscriptFile(session, transcript, format) {
  const baseName = `captionai-${session.title}`
    .normalize('NFKD')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 100) || 'captionai-transcript'

  const contents = format === 'srt'
    ? transcript.map((entry, index) => (
      `${index + 1}\n${formatSrtTime(entry.startTime)} --> ${formatSrtTime(entry.endTime)}\n${entry.text.trim()}`
    )).join('\n\n')
    : [
      'CaptionAI transcript',
      `Session: ${session.title}`,
      `Date: ${session.dateLabel}`,
      `Language: ${session.language}`,
      `Duration: ${session.duration}`,
      '',
      ...transcript.map((entry) => `[${formatTime(entry.startTime)}–${formatTime(entry.endTime)}] ${entry.text.trim()}`),
    ].join('\n')

  const mimeType = format === 'srt' ? 'application/x-subrip;charset=utf-8' : 'text/plain;charset=utf-8'
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${baseName}.${format}`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function TranscriptRow({ entry, language, fontSize, density }) {
  const percent = Math.round((entry.confidence ?? 0) * 100)
  const hasEmotion = Boolean(entry.emotion)
  const emotion = getEmotionPresentation(entry.emotion)
  const textSizeClass = fontSize === 'small' ? 'text-base' : fontSize === 'large' ? 'text-2xl' : 'text-[1.0625rem]'
  const rowSpacingClass = density === 'compact' ? 'py-3' : 'py-5'

  return (
    <li className={`grid gap-3 px-5 sm:grid-cols-[3.5rem_minmax(0,1fr)_7rem] sm:gap-5 sm:px-7 ${rowSpacingClass}`}>
      <time className="pt-0.5 text-xs font-medium tabular-nums text-subtle">{formatTime(entry.startTime)}</time>
      <div>
        <p className={`leading-7 text-ink ${textSizeClass}`}>{entry.text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${emotionStyle[entry.emotion] ?? emotionStyle.neutral}`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {emotion && <span aria-hidden="true">{emotion.emoji}</span>}
            {entry.emotion ?? (language === 'English' ? 'Not analyzed' : 'English-only emotion model')}
          </span>
          <span className="text-xs text-subtle">{language}</span>
          <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-muted">{formatProvider(entry.provider)}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:block sm:text-right">
        <p className="text-xs text-subtle sm:mb-1">Model score</p>
        <p className="text-sm font-medium tabular-nums text-muted">{hasEmotion ? `${percent}%` : '—'}</p>
        {hasEmotion && (
          <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-surface-subtle sm:ml-0 sm:mt-2 sm:w-full" role="img" aria-label={`Model score ${percent} percent`}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
    </li>
  )
}

export default function SessionDetails() {
  const { sessionId } = useParams()
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [titleError, setTitleError] = useState('')
  const preferences = readPreferences(user.id, user.preferences)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setEditingTitle(false)
    setTitleDraft('')
    setTitleError('')
    getSession(sessionId)
      .then((result) => {
        if (!active) return
        setSession(result.session)
        setTranscript(result.transcripts)
      })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sessionId])

  async function saveTitle(event) {
    event.preventDefault()
    const title = titleDraft.trim()
    if (!title || title.length > 120) {
      setTitleError('Enter a title between 1 and 120 characters.')
      return
    }
    setSavingTitle(true)
    setTitleError('')
    try {
      const updatedSession = await updateSessionTitle(session.id, title)
      setSession(updatedSession)
      setEditingTitle(false)
    } catch (saveError) {
      setTitleError(saveError.message)
    } finally {
      setSavingTitle(false)
    }
  }

  if (loading) {
    return <AppShell><p className="rounded-lg border border-line bg-surface px-6 py-12 text-center text-sm text-muted">Loading session…</p></AppShell>
  }

  if (!session) {
    return (
      <AppShell>
        <section className="rounded-lg border border-line bg-surface px-6 py-12 text-center">
          <h1 className="text-xl font-semibold text-ink">{error ? 'Could not load session' : 'Session not found'}</h1>
          <p role={error ? 'alert' : undefined} className="mt-2 text-sm text-muted">{error || 'This session may have been removed or is unavailable.'}</p>
          <Link to="/history" className="mt-4 inline-flex min-h-10 items-center rounded-md bg-brand px-4 text-sm font-semibold text-surface hover:bg-brand-hover">Back to history</Link>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-7">
        <header>
          <Link to="/history" className="text-sm font-medium text-muted hover:text-brand focus-visible:outline-offset-2">← Session history</Link>
          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-meta font-semibold uppercase tracking-[0.1em] text-brand">{session.status === 'completed' ? 'Completed session' : 'Active session'}</p>
              {!editingTitle ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-ink">{session.title}</h1>
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(session.title)
                      setTitleError('')
                      setEditingTitle(true)
                    }}
                    className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-muted hover:bg-surface-subtle focus-visible:outline-offset-2"
                  >
                    Rename
                  </button>
                </div>
              ) : (
                <form onSubmit={saveTitle} className="mt-3 flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <label className="sr-only" htmlFor="edit-session-title">Session title</label>
                    <input
                      id="edit-session-title"
                      type="text"
                      maxLength={120}
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      aria-invalid={Boolean(titleError)}
                      aria-describedby={titleError ? 'session-title-error' : undefined}
                      className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      autoFocus
                    />
                    {titleError && <p id="session-title-error" role="alert" className="mt-1 text-xs text-critical">{titleError}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingTitle} className="min-h-11 rounded-md bg-brand px-4 text-sm font-semibold text-surface hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60 focus-visible:outline-offset-2">
                      {savingTitle ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" disabled={savingTitle} onClick={() => setEditingTitle(false)} className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-surface-subtle disabled:opacity-60 focus-visible:outline-offset-2">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              <p className="mt-2 text-sm text-muted">{session.dateLabel}</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-subtle px-3 py-1.5 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-subtle" aria-hidden="true" />
              {session.status === 'completed' ? 'Saved session' : 'In progress'}
            </span>
          </div>
        </header>

        <section aria-label="Session summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Duration', session.duration],
            ['Language', session.language],
            ['Captions', String(transcript.length)],
            ['Emotion summary', session.emotionSummary],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-surface px-4 py-4">
              <p className="text-xs font-medium text-subtle">{label}</p>
              <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="transcript-heading" className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex flex-col justify-between gap-3 border-b border-line px-5 py-5 sm:flex-row sm:items-end sm:px-7">
            <div>
              <h2 id="transcript-heading" className="text-lg font-semibold tracking-tight text-ink">Transcript</h2>
              <p className="mt-1 text-sm text-muted">Caption segments with timestamps. Export a copy to use or share elsewhere.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-subtle">{transcript.length} saved segments</p>
              <button
                type="button"
                disabled={!transcript.length}
                onClick={() => downloadTranscriptFile(session, transcript, 'txt')}
                className="min-h-10 rounded-md border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-offset-2"
              >
                Download .txt
              </button>
              <button
                type="button"
                disabled={!transcript.length}
                onClick={() => downloadTranscriptFile(session, transcript, 'srt')}
                className="min-h-10 rounded-md bg-brand px-3 text-sm font-semibold text-surface hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-offset-2"
              >
                Download .srt
              </button>
            </div>
          </div>
          <ol className="divide-y divide-line" aria-label="Transcript segments">
            {transcript.length ? transcript.map((entry) => <TranscriptRow key={entry.id} entry={entry} language={entry.language} fontSize={preferences.fontSize} density={preferences.density} />) : (
              <li className="px-6 py-12 text-center text-sm leading-6 text-muted">No transcript segments have been saved for this session. Captions appear here after a live session runs in Whisper mode.</li>
            )}
          </ol>
          <p className="border-t border-line bg-canvas px-5 py-3 text-xs leading-5 text-subtle sm:px-7">
            Emotion labels are uncertain estimates of vocal tone. The current local model supports English speech only.
          </p>
        </section>
      </div>
    </AppShell>
  )
}
