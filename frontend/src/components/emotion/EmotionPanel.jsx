import { getEmotionPresentation } from '../../utils/emotionDisplay.js'

const emotionStyles = {
  neutral: 'bg-surface-subtle text-muted',
  happy: 'bg-positive-soft text-positive',
  sad: 'bg-brand-soft text-brand',
  angry: 'bg-critical-soft text-critical',
}

export default function EmotionPanel({ caption, recentEmotions }) {
  const emotion = caption?.emotion ?? 'Not analyzed'
  const confidence = caption?.confidence ?? 0
  const confidencePercent = Math.round(confidence * 100)
  const style = emotionStyles[emotion] ?? emotionStyles.neutral
  const emotionDisplay = getEmotionPresentation(caption?.emotion)
  const sourceLabel = caption?.emotion
    ? (caption.source === 'mock' ? 'Mock sample' : 'Local speech model')
    : caption?.emotionPending
      ? 'Analyzing'
      : caption?.emotionUncertain
        ? 'Uncertain'
        : caption?.emotionUnsupported
          ? 'English only'
          : caption?.emotionUnavailable
            ? 'Unavailable'
            : 'Pending'

  return (
    <section aria-labelledby="emotion-heading" className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="emotion-heading" className="text-sm font-semibold text-ink">Emotion context</h2>
          <p className="mt-1 text-xs text-muted">A supporting signal for the current caption</p>
        </div>
        <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-subtle">{sourceLabel}</span>
      </div>

      <div className="mt-5 rounded-md border border-line p-4">
        <p className="text-xs font-medium text-subtle">Current emotion</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${style}`}>
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
            {emotionDisplay && <span aria-hidden="true">{emotionDisplay.emoji}</span>}
            {caption?.emotionPending
              ? 'Analyzing…'
              : caption?.emotionUncertain
                ? 'Unclear'
                : caption?.emotionUnsupported
                  ? 'Not available'
                  : emotion}
          </span>
          <span className="text-sm font-semibold tabular-nums text-ink">{caption?.emotion ? `${confidencePercent}% score` : '—'}</span>
        </div>
        {caption?.emotion && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-subtle" role="img" aria-label={`Model score ${confidencePercent} percent`}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${confidencePercent}%` }} />
          </div>
        )}
        <p className="mt-2 text-xs text-subtle">
          {caption?.emotionUncertain
            ? 'No label is shown because the model score or its lead over the next label was too small.'
            : caption?.emotionUnsupported
              ? 'This speech emotion model currently supports English audio.'
              : caption?.emotionUnavailable
                ? 'Speech emotion analysis could not run for this caption.'
                : 'An uncertain vocal-tone estimate, not a reliable assessment of how someone feels.'}
        </p>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-ink">Recent emotion timeline</h3>
          <span className="text-xs text-subtle">Last captions</span>
        </div>
        <div className="mt-3 flex h-10 items-end gap-1.5" role="img" aria-label={`Recent speech emotion estimates: ${recentEmotions.map(({ emotion: item }) => item).join(', ') || 'none yet'}`}>
          {recentEmotions.length ? recentEmotions.map((item, index) => (
            <span
              key={`${item.id}-${index}`}
              title={`${item.emotion} · ${item.language}`}
              className={`min-w-2 flex-1 rounded-sm ${emotionStyles[item.emotion]?.split(' ')[0] ?? 'bg-surface-subtle'} border border-line`}
              style={{ height: `${40 + (index % 3) * 20}%` }}
            />
          )) : <span className="text-xs text-muted">No sample readings yet.</span>}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-subtle"><span>Earlier</span><span>Now</span></div>
      </div>
      <p className="mt-4 border-t border-line pt-3 text-xs leading-5 text-subtle">Emotion labels are model estimates. The panel omits low-consensus predictions instead of forcing a label.</p>
    </section>
  )
}
