import { Link } from 'react-router-dom'

const languages = [
  { name: 'English', native: 'English' },
  { name: 'Hindi', native: 'हिन्दी' },
  { name: 'Telugu', native: 'తెలుగు' },
]

const capabilities = [
  {
    number: '01',
    label: 'Live captions',
    title: 'Keep speech in view',
    detail: 'Follow incoming speech as readable text, with the current caption kept prominent and earlier lines available for context.',
    note: 'Listen and read at the same time',
  },
  {
    number: '02',
    label: 'Three languages',
    title: 'Work across languages',
    detail: 'Choose English, Hindi, or Telugu for a session. The selected language stays visible as you follow the transcript.',
    note: 'English · हिन्दी · తెలుగు',
  },
  {
    number: '03',
    label: 'Optional context',
    title: 'Review more than the words',
    detail: 'When available, speech emotion estimates appear alongside captions to offer another signal for later review.',
    note: 'Estimates are not certain judgments',
  },
]

const steps = [
  ['01', 'Set up your session', 'Choose English, Hindi, or Telugu, then check your microphone and caption display preferences before you begin.'],
  ['02', 'Follow the conversation', 'Start a live session and read the incoming captions as speech is transcribed. Emotion context is shown separately when available.'],
  ['03', 'Keep what matters', 'Stop the session to save its transcript. Reopen it later in history or download it as a TXT or SRT file.'],
]

const accessibilityFeatures = [
  {
    title: 'Choose a comfortable text size',
    detail: 'Set caption text to small, regular, or large so it is easier to follow from your screen.',
  },
  {
    title: 'Adjust the reading density',
    detail: 'Use the comfortable or compact transcript layout to match your reading preference.',
  },
  {
    title: 'Tune the display',
    detail: 'Switch themes, enable higher contrast, or reduce motion in settings.',
  },
]

const faqs = [
  {
    question: 'Which languages can I use?',
    answer: 'CaptionAI currently supports English, Hindi, and Telugu sessions.',
  },
  {
    question: 'Does CaptionAI save microphone recordings?',
    answer: 'CaptionAI saves transcript text for session history, not raw audio recordings. Audio chunks are sent to the selected transcription service; Groq mode sends them to Groq, while local Whisper mode uses your local AI service.',
  },
  {
    question: 'How should I understand the emotion labels?',
    answer: 'They are estimates of vocal tone and can be wrong. Treat them as optional context, not as a definite description of what someone feels.',
  },
  {
    question: 'Can I revisit or export a transcript?',
    answer: 'Saved sessions appear in Session history. Open a session to review its captions and download a TXT or SRT transcript.',
  },
  {
    question: 'What happens if Groq transcription is unavailable?',
    answer: 'In Groq mode, CaptionAI tries the local Whisper service as a fallback. The local AI service needs to be running for that fallback to work.',
  },
]

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-canvas text-ink">
      <header className="landing-header isolate border-b border-line shadow-sm">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3 rounded-sm focus-visible:outline-offset-4" aria-label="CaptionAI home">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-brand text-sm font-bold text-surface" aria-hidden="true">C</span>
            <span className="text-base font-semibold tracking-tight">CaptionAI</span>
          </a>
          <nav aria-label="Main navigation" className="hidden items-center sm:flex">
            <a className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-subtle hover:text-ink" href="#capabilities">Capabilities</a>
            <a className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-subtle hover:text-ink" href="#how-it-works">How it works</a>
            <a className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-subtle hover:text-ink" href="#accessibility">Accessibility</a>
            <a className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-subtle hover:text-ink" href="#faq">FAQ</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/signin" className="inline-flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-offset-4">
              Sign in
            </Link>
            <Link to="/signup" className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-surface transition-colors hover:bg-brand-hover focus-visible:outline-offset-4">
              Start captioning
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        <section aria-labelledby="landing-heading" className="relative z-0 overflow-hidden bg-ink text-surface">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-surface/20 bg-surface/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-surface/80">
                <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
                Real-time multilingual captions
              </p>
              <h1 id="landing-heading" className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Follow every word.<br />
                <span className="text-surface/65">Keep the context.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-surface/75 sm:text-lg sm:leading-8">
                Turn live speech into readable captions in English, Hindi, or Telugu. Review the transcript and see optional emotional context in one focused workspace.
              </p>
              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
                <Link to="/signup" className="inline-flex min-h-12 items-center gap-3 rounded-lg bg-surface px-6 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-subtle focus-visible:outline-offset-4">
                  Start captioning
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M4 10h11M10 5l5 5-5 5" /></svg>
                </Link>
                <a href="#capabilities" className="inline-flex min-h-12 items-center rounded-lg px-5 text-sm font-semibold text-surface/85 transition-colors hover:bg-surface/10 focus-visible:outline-offset-4">
                  Explore the workspace
                </a>
              </div>
              <div className="mt-10 pt-2">
                <p className="text-xs font-medium text-surface/60">Supported languages</p>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2" aria-label="Supported languages">
                  {languages.map((language) => (
                    <li key={language.name} className="flex items-center gap-2 text-sm font-medium text-surface/90">
                      <span className="h-1 w-1 rounded-full bg-surface/60" aria-hidden="true" />
                      {language.native}
                      {language.native !== language.name && <span className="text-xs text-surface/60">{language.name}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <figure className="relative mx-auto w-full max-w-xl lg:ml-auto">
              <div className="absolute -inset-3 rounded-2xl border border-surface/10" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-2xl shadow-black/20">
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
                  <div>
                    <p className="text-sm font-semibold text-ink">Live caption workspace</p>
                    <p className="mt-0.5 text-xs text-muted">Sample interface · English</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-surface-subtle px-3 py-1.5 text-xs font-medium text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                    Preview
                  </span>
                </div>
                <div className="px-5 py-7 sm:px-7 sm:py-9">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-subtle">Current caption · 00:14</p>
                  <p className="mt-4 max-w-lg text-2xl font-medium leading-relaxed tracking-tight text-ink sm:text-3xl">
                    “Clear communication should be within everyone’s reach.”
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="rounded-full bg-surface-subtle px-2.5 py-1">English</span>
                    <span className="rounded-full bg-surface-subtle px-2.5 py-1">Neutral tone estimate</span>
                  </div>
                </div>
                <div className="border-t border-line bg-canvas px-5 py-4 sm:px-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">Previous caption · 00:09</p>
                  <p className="mt-2 text-sm leading-6 text-muted">“Welcome. We’re glad you’re here.”</p>
                </div>
              </div>
              <figcaption className="mt-4 text-center text-xs text-surface/60">Illustrative preview of the captioning workspace</figcaption>
            </figure>
          </div>
        </section>

        <section id="capabilities" className="scroll-mt-24 border-b border-line bg-canvas">
          <div className="landing-container mx-auto max-w-7xl px-5 py-32 sm:px-8 sm:py-36">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Designed for the conversation</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Words first. Context when it helps.</h2>
              </div>
              <p className="max-w-lg text-base leading-7 text-muted">Keep the transcript at the center of the session, then use language, history, and optional emotion details when you need them.</p>
            </div>
            <div className="landing-feature-grid mt-16 grid gap-6 md:grid-cols-3 md:gap-7">
              {capabilities.map((item) => (
                <article key={item.number} className="landing-feature-card flex min-h-72 flex-col rounded-2xl border border-line bg-surface p-7 shadow-sm sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">{item.label}</span>
                    <span className="text-xs font-semibold tabular-nums text-subtle">{item.number}</span>
                  </div>
                  <h3 className="mt-8 text-xl font-semibold tracking-tight text-ink">{item.title}</h3>
                  <p className="landing-card-detail mt-4 text-base leading-7 text-muted">{item.detail}</p>
                  <p className="mt-auto border-t border-line pt-5 text-xs font-medium leading-5 text-subtle">{item.note}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-base leading-7 text-muted">CaptionAI keeps these tools together: live speech, a transcript you can return to, and presentation controls that fit your needs.</p>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 bg-surface">
          <div className="landing-container mx-auto max-w-7xl px-5 py-32 sm:px-8 sm:py-36">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">A simple session flow</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">From spoken words to a transcript you can revisit.</h2>
              <p className="mt-4 text-base leading-7 text-muted">Start with a language, follow along live, then review or export the transcript.</p>
            </div>
            <ol className="landing-step-grid mt-16 grid gap-6 md:grid-cols-3 md:gap-7">
              {steps.map(([number, title, detail]) => (
                <li key={number} className="landing-step-card flex min-h-72 flex-col rounded-2xl border border-line bg-canvas p-7 sm:p-8">
                  <span className="inline-grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-sm font-semibold tabular-nums text-brand">{number}</span>
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-ink">{title}</h3>
                    <p className="mt-4 text-base leading-7 text-muted">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="landing-history-banner mt-10 flex flex-col gap-4 rounded-2xl border border-line bg-canvas p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <h3 className="text-base font-semibold text-ink">Your sessions stay easy to revisit</h3>
                <p className="mt-2 text-sm leading-6 text-muted">Saved transcripts are organized in your session history.</p>
              </div>
              <Link to="/history" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-offset-4">Browse session history</Link>
            </div>
          </div>
        </section>

        <section id="accessibility" className="scroll-mt-24 border-y border-line bg-brand-soft">
          <div className="landing-container mx-auto max-w-7xl px-5 py-32 sm:px-8 sm:py-36">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Accessibility in the details</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Make the reading experience yours.</h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted">Caption and display preferences are available in settings, so you can shape the workspace around how you prefer to read.</p>
              </div>
              <Link to="/settings" className="landing-accessibility-cta inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-surface px-5 text-sm font-semibold text-brand transition-colors hover:bg-surface-subtle focus-visible:outline-offset-4">
                Explore settings
              </Link>
            </div>
            <div className="landing-accessibility-grid mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
              {accessibilityFeatures.map((feature, index) => (
                <article key={feature.title} className="landing-accessibility-card min-h-52 rounded-2xl border border-brand/10 bg-surface/80 p-7 sm:p-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">Preference 0{index + 1}</p>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{feature.title}</h3>
                  <p className="mt-3 text-base leading-7 text-muted">{feature.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-24 bg-canvas">
          <div className="landing-container mx-auto max-w-7xl px-5 py-32 sm:px-8 sm:py-36">
            <div className="landing-faq-layout grid gap-10 sm:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.2fr)] sm:gap-12 lg:gap-20">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Good to know</p>
                <h2 id="faq-heading" className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Frequently asked questions</h2>
                <p className="mt-4 max-w-sm text-sm leading-6 text-muted">A few details about languages, privacy, and how CaptionAI handles a session.</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-line bg-surface px-5 sm:px-7">
                {faqs.map(({ question, answer }) => (
                  <details key={question} className="group border-b border-line py-5 last:border-b-0 sm:py-6">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-5 rounded-sm text-left text-base font-semibold leading-6 text-ink focus-visible:outline-offset-4 [&::-webkit-details-marker]:hidden">
                      {question}
                      <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-lg font-normal text-muted transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="max-w-2xl pr-12 pt-3 text-sm leading-7 text-muted">{answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
          <a href="#top" className="flex w-fit items-center gap-2 rounded-sm focus-visible:outline-offset-4" aria-label="CaptionAI home">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-brand text-xs font-bold text-surface" aria-hidden="true">C</span>
            <span className="text-sm font-semibold text-ink">CaptionAI</span>
          </a>
          <p className="text-sm text-muted">Real-time multilingual captioning with emotional context.</p>
          <p className="text-xs text-subtle">English · हिन्दी · తెలుగు</p>
        </div>
      </footer>
    </div>
  )
}
