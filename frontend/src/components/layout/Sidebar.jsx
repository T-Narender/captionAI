import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const primaryNavigation = [
  { label: 'Overview', to: '/dashboard' },
  { label: 'Live session', to: '/live' },
  { label: 'Session history', to: '/history' },
]

const workspaceNavigation = [
  { label: 'Profile', to: '/profile' },
  { label: 'Settings', to: '/settings' },
]

function NavigationGroup({ label, items, onNavigate }) {
  return (
    <div className="mb-7">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
        {label}
      </p>
      <ul className="space-y-1">
        {items.map(({ label: itemLabel, to }) => (
          <li key={itemLabel}>
            <NavLink
              to={to}
              end
              onClick={onNavigate}
              className={({ isActive }) => `flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-offset-2 ${
                isActive
                  ? 'bg-brand-soft text-brand'
                  : 'text-muted hover:bg-surface-subtle hover:text-ink'
              }`}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              {itemLabel}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth()
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-ink/30 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        id="primary-navigation"
        aria-label="Primary navigation"
        className={`fixed left-0 top-0 z-40 h-dvh w-64 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-5 md:flex ${
          open ? 'flex shadow-xl' : 'hidden'
        }`}
      >
        <div className="flex items-center gap-3 px-2 pb-8 pt-1">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-brand text-sm font-bold text-white">
            C
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink">CaptionAI</p>
            <p className="text-xs text-subtle">Live captioning</p>
          </div>
        </div>

        <nav className="flex-1" aria-label="Workspace">
          <NavigationGroup label="Workspace" items={primaryNavigation} onNavigate={onClose} />
          <NavigationGroup label="Preferences" items={workspaceNavigation} onNavigate={onClose} />
        </nav>

        <div className="border-t border-line px-2 pt-4">
          <p className="truncate text-xs font-medium text-ink">{user?.displayName || 'CaptionAI workspace'}</p>
          <p className="mt-1 truncate text-xs leading-5 text-subtle">{user?.email || 'Live captions and saved session history.'}</p>
        </div>
      </aside>
    </>
  )
}
