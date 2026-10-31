import { getEmotionPresentation } from '../../utils/emotionDisplay.js'

function formatTimestamp(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export default function CaptionDisplay({ caption, status, fontSize = 'regular', density = 'comfortable' }) {
  const textSizeClass = fontSize === 'small' ? 'text-2xl sm:text-3xl' : fontSize === 'large' ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
  const verticalSpacingClass = density === 'compact' ? 'py-5' : 'py-10'
  const emotion = getEmotionPresentation(caption?.emotion)

  return (
    <section aria-labelledby="current-caption-heading" className={`flex min-h-[24rem] flex-col rounded-lg border border-line bg-surface p-6 shadow-sm sm:p-9 ${density === 'compact' ? 'min-h-[20rem]' : ''}`}>
      <div className="flex items-center justify-between gap-4">
        <h2 id="current-caption-heading" className="text-meta font-semibold uppercase tracking-[0.1em] text-subtle">Current caption</h2>
        {status === 'recording' && <span className="text-xs font-medium text-positive">Receiving captions</span>}
      </div>
      {caption ? (
        <div className={`flex flex-1 flex-col justify-center ${verticalSpacingClass}`} role="status" aria-live="polite" aria-atomic="true">
          <p className={`max-w-3xl font-medium leading-relaxed tracking-tight text-ink ${textSizeClass}`}>
            {caption.text}
          </p>
          {emotion && (
            <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-semibold capitalize text-brand" aria-label={`Estimated ${emotion.label.toLowerCase()} vocal tone`}>
              <span aria-hidden="true" className="text-lg">{emotion.emoji}</span>
              {emotion.label} tone
            </span>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
            <span>{caption.language}</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-line" />
            <span className="tabular-nums">{formatTimestamp(caption.startTime)}</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-line" />
            <span className="capitalize">{caption.emotion ? `${caption.emotion} tone` : caption.emotionPending ? 'Emotion analysis pending' : caption.emotionUnsupported ? 'Emotion analysis supports English only' : caption.emotionUncertain ? 'Emotion unclear' : 'Emotion not analyzed'}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-10 text-center">
          <p className="max-w-sm text-sm leading-6 text-muted">{status === 'stopped' ? 'This session has ended. Start a new session to receive captions.' : 'Start a session to connect and receive live captions.'}</p>
        </div>
      )}
      <p className="border-t border-line pt-4 text-xs leading-5 text-subtle">Audio is sent to the selected transcription service; CaptionAI does not save audio recordings. Caption source is shown beside the session title.</p>
    </section>
  )
}
