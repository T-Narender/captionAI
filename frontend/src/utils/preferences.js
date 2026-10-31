export const preferenceStorageKey = 'captionai-settings'

export const defaultPreferences = {
  language: 'English',
  microphoneId: 'default',
  fontSize: 'regular',
  density: 'comfortable',
  theme: 'light',
  highContrast: false,
  reducedMotion: false,
}

export function readPreferences(userId, accountPreferences = {}) {
  try {
    const saved = userId
      ? JSON.parse(window.localStorage.getItem(`${preferenceStorageKey}:${userId}:device`) ?? 'null')
      : null
    return { ...defaultPreferences, ...accountPreferences, ...(saved ? { microphoneId: saved.microphoneId } : {}) }
  } catch {
    return { ...defaultPreferences, ...accountPreferences }
  }
}

export function applyGlobalPreferences(preferences) {
  document.documentElement.dataset.theme = preferences.theme
  document.documentElement.classList.toggle('high-contrast', preferences.highContrast)
  document.documentElement.classList.toggle('user-reduced-motion', preferences.reducedMotion)
}

export function savePreferences(preferences, userId) {
  if (!userId) return
  try {
    window.localStorage.setItem(`${preferenceStorageKey}:${userId}:device`, JSON.stringify({ microphoneId: preferences.microphoneId }))
  } catch {
    // The app remains usable when browser storage is unavailable.
  }
}
