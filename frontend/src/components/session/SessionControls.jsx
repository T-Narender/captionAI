export default function SessionControls({ status, elapsed, onStart, onPause, onStop }) {
  const formattedTime = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  const stopped = status === 'stopped'
  const busy = ['connecting', 'pausing', 'resuming', 'stopping'].includes(status)
  const canStop = (status === 'recording' || status === 'paused') && !busy
  const stateLabel = {
    idle: 'Ready to start',
    connecting: 'Connecting to backend…',
    recording: 'Session in progress',
    paused: 'Session paused',
    pausing: 'Pausing session…',
    resuming: 'Resuming session…',
    stopping: 'Saving session…',
    stopped: 'Session ended',
  }[status] ?? 'Session ready'

  return (
    <section aria-label="Session controls" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${status === 'recording' ? 'animate-pulse bg-positive' : status === 'paused' || busy ? 'bg-caution' : 'bg-subtle'}`} aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-ink">{stateLabel}</p>
          <p className="text-xs text-muted">Elapsed time <span className="ml-1 font-medium tabular-nums text-ink">{formattedTime}</span></p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === 'recording' || status === 'pausing' ? (
          <button type="button" onClick={onPause} disabled={busy} className="min-h-10 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-surface-subtle disabled:cursor-wait disabled:opacity-60 focus-visible:outline-offset-2">{status === 'pausing' ? 'Pausing…' : 'Pause'}</button>
        ) : (
          <button type="button" onClick={onStart} disabled={busy} className="min-h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60 focus-visible:outline-offset-2">
            {busy ? 'Please wait…' : stopped ? 'Start new session' : status === 'idle' ? 'Start session' : 'Resume'}
          </button>
        )}
        <button
          type="button"
          onClick={onStop}
          disabled={!canStop}
          className="min-h-10 rounded-md border border-critical/30 px-4 text-sm font-semibold text-critical hover:bg-critical-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-offset-2"
        >
          Stop session
        </button>
      </div>
    </section>
  )
}
