import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

function AuthLoading() {
  return <main className="grid min-h-screen place-items-center bg-canvas px-5 text-sm text-muted">Checking your sign-in…</main>
}

export function RequireAuth({ children }) {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'checking') return <AuthLoading />
  if (!user) return <Navigate to="/signin" replace state={{ from: location }} />
  return children
}

export function GuestOnly({ children }) {
  const { user, status } = useAuth()
  if (status === 'checking') return <AuthLoading />
  return user ? <Navigate to="/dashboard" replace /> : children
}
