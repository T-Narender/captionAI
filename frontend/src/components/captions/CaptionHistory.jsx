import { getEmotionPresentation } from '../../utils/emotionDisplay.js'

function formatTimestamp(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export default function CaptionHistory({ captions, density = 'comfortable' }) {
  const rowSpacingClass = density === 'compact' ? 'py-2.5' : 'py-4'
  return (
    <section aria-labelledby="previous-captions-heading" className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="previous-captions-heading" className="text-sm font-semibold text-ink">Previous captions</h2>
        <span className="text-xs text-subtle">This session</span>
      </div>
      {captions.length ? (
        <ol className="divide-y divide-line">
          {captions.map((caption) => (
            <li key={caption.id} className={`flex gap-4 px-5 ${rowSpacingClass}`}>
              <time className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-subtle">{formatTimestamp(caption.startTime)}</time>
              <div className="min-w-0">
                <p className="text-sm leading-6 text-muted">{caption.text}</p>
                {getEmotionPresentation(caption.emotion) && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold capitalize text-brand" aria-label={`Estimated ${caption.emotion} vocal tone`}>
                    <span aria-hidden="true">{getEmotionPresentation(caption.emotion).emoji}</span>
                    {caption.emotion} tone
                  </span>
                )}
                <p className="mt-1 text-xs text-subtle">
                  {caption.language}<span className="px-2" aria-hidden="true">·</span>
                  <span>{caption.provider === 'groq'
                    ? 'Groq Whisper'
                    : caption.provider === 'local-whisper-fallback'
                      ? 'Local Whisper fallback'
                      : caption.provider === 'local-whisper'
                        ? 'Local Whisper'
                        : 'Backend mock'}</span><span className="px-2" aria-hidden="true">·</span>
                  <span className="capitalize">{caption.emotion ?? (caption.emotionPending ? 'Analyzing emotion' : caption.emotionUncertain ? 'Emotion unclear' : caption.emotionUnsupported ? 'Emotion unsupported' : 'Emotion not analyzed')}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-6 text-sm text-muted">Previous captions will appear here.</p>
      )}
    </section>
  )
}
