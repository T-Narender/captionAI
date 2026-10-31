import { useEffect, useRef, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

export default function AppShell({ children }) {
  const [navigationOpen, setNavigationOpen] = useState(false)
  const menuButtonRef = useRef(null)

  useEffect(() => {
    if (!navigationOpen) return undefined

    document.querySelector('#primary-navigation a')?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') setNavigationOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      menuButtonRef.current?.focus()
    }
  }, [navigationOpen])

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-col md:pl-64">
        <Topbar
          onMenuClick={() => setNavigationOpen(true)}
          menuButtonRef={menuButtonRef}
          navigationOpen={navigationOpen}
        />
        <main id="main-content" className="w-full flex-1 px-5 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
        <footer className="border-t border-line bg-surface px-5 py-5 sm:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold text-muted">CaptionAI</p>
            <p>Real-time multilingual captions with emotional context.</p>
            <p>© {new Date().getFullYear()} CaptionAI</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
