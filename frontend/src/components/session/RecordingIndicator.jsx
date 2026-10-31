export default function RecordingIndicator({ status }) {
  const label = status === 'recording' ? 'Backend mock active' : status === 'paused' ? 'Paused' : status === 'idle' ? 'Ready' : 'Stopped'
  const tone = status === 'recording' ? 'bg-positive-soft text-positive' : status === 'paused' ? 'bg-caution-soft text-caution' : 'bg-surface-subtle text-muted'

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'recording' ? 'animate-pulse bg-positive' : status === 'paused' ? 'bg-caution' : 'bg-subtle'}`} aria-hidden="true" />
      {label}
    </span>
  )
}
