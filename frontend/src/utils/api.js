export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

async function request(path, options) {
  let response
  const { headers: requestHeaders, ...fetchOptions } = options ?? {}
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...requestHeaders },
    })
  } catch {
    const error = new Error('Cannot reach the CaptionAI backend.')
    error.code = 'NETWORK_ERROR'
    throw error
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return result
}

export function registerAccount({ displayName, email, password }) {
  return request('/api/auth/register', { method: 'POST', body: JSON.stringify({ displayName, email, password }) })
}

export function signInAccount({ email, password }) {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function signOutAccount() {
  return request('/api/auth/logout', { method: 'POST' })
}

export function getCurrentUser() {
  return request('/api/auth/me')
}

export function updateCurrentUser({ displayName }) {
  return request('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ displayName }) })
}

export function updateCurrentUserPreferences(preferences) {
  return request('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ preferences }) })
}

export function getSessions({ search = '', language = '', date = '', page, limit } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (language && language !== 'all') params.set('language', language)
  if (date) params.set('date', date)
  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))
  const query = params.size ? `?${params.toString()}` : ''
  return request(`/api/sessions${query}`).then(({ sessions, pagination }) => ({
    sessions: sessions.map(toSessionView),
    pagination,
  }))
}

export function getRecentTranscripts() {
  return request('/api/sessions/recent-transcripts').then(({ transcripts }) => transcripts.map((transcript) => ({
    ...transcript,
    id: transcript._id,
    sessionId: transcript.sessionId,
    language: { en: 'English', hi: 'Hindi', te: 'Telugu' }[transcript.language] ?? transcript.language,
  })))
}

export function getSession(id) {
  return request(`/api/sessions/${encodeURIComponent(id)}`).then(({ session, transcripts }) => ({
    session: toSessionView(session),
    transcripts: transcripts.map((item) => ({
      ...item,
      id: item._id,
      confidence: item.emotionConfidence ?? 0,
      language: { en: 'English', hi: 'Hindi', te: 'Telugu' }[item.language] ?? item.language,
    })),
  }))
}

export function createSession({ title, language }) {
  return request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ title, language }),
  }).then(({ session }) => session)
}

export function updateSessionTitle(id, title) {
  return request(`/api/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  }).then(({ session }) => toSessionView(session))
}

export function endSession(id) {
  return request(`/api/sessions/${encodeURIComponent(id)}/end`, { method: 'POST' })
    .then(({ session }) => session)
}

export function deleteSession(id) {
  return request(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function toSessionView(session) {
  const start = new Date(session.startTime ?? session.createdAt)
  const durationSeconds = session.duration ?? 0
  const minutes = Math.floor(durationSeconds / 60)
  const languageNames = { en: 'English', hi: 'Hindi', te: 'Telugu' }
  return {
    ...session,
    id: session._id,
    date: Number.isNaN(start.getTime()) ? '' : start.toISOString().slice(0, 10),
    dateLabel: Number.isNaN(start.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(start),
    durationSeconds,
    duration: `${minutes} min`,
    language: languageNames[session.language] ?? session.language,
    captionCount: session.captionCount ?? 0,
    emotionSummary: session.emotionSummary ?? 'Not analyzed',
  }
}
