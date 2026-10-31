import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getCurrentUser, registerAccount, signInAccount, signOutAccount, updateCurrentUser, updateCurrentUserPreferences } from '../utils/api.js'
import { applyGlobalPreferences, defaultPreferences, readPreferences } from '../utils/preferences.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let active = true
    getCurrentUser()
      .then(({ user: currentUser }) => {
        if (!active) return
        setUser(currentUser)
        setStatus('signed-in')
      })
      .catch(() => {
        if (!active) return
        setUser(null)
        setStatus('signed-out')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const preferences = user
      ? readPreferences(user.id, user.preferences)
      : defaultPreferences
    applyGlobalPreferences(preferences)
  }, [user, status])

  async function signIn(credentials) {
    const result = await signInAccount(credentials)
    setUser(result.user)
    setStatus('signed-in')
    return result.user
  }

  async function signUp(details) {
    const result = await registerAccount(details)
    setUser(result.user)
    setStatus('signed-in')
    return result.user
  }

  async function signOut() {
    try {
      await signOutAccount()
    } finally {
      setUser(null)
      setStatus('signed-out')
    }
  }

  async function updateProfile(details) {
    const result = await updateCurrentUser(details)
    setUser(result.user)
    return result.user
  }

  async function updatePreferences(preferences) {
    const result = await updateCurrentUserPreferences(preferences)
    setUser(result.user)
    return result.user.preferences
  }

  const value = useMemo(() => ({ user, status, signIn, signUp, signOut, updateProfile, updatePreferences }), [user, status])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
