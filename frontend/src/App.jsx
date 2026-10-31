import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LiveSession from './pages/LiveSession.jsx'
import SessionDetails from './pages/SessionDetails.jsx'
import Settings from './pages/Settings.jsx'
import Profile from './pages/Profile.jsx'
import AuthPage from './pages/AuthPage.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { GuestOnly, RequireAuth } from './components/auth/RouteGuards.jsx'

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<GuestOnly><AuthPage mode="signin" /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><AuthPage mode="signup" /></GuestOnly>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/live" element={<RequireAuth><LiveSession /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
        <Route path="/history/:sessionId" element={<RequireAuth><SessionDetails /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  )
}
