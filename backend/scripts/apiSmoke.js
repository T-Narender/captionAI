import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const baseUrl = (process.env.BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '')

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...(options.headers ?? {}), ...(cookie ? { Cookie: cookie } : {}) },
  })
  const body = await response.json()
  return { response, body }
}

let cookie = ''

const health = await request('/api/health')
assert.equal(health.response.status, 200)
assert.equal(health.body.success, true)
console.log('GET /api/health passed')

const anonymousList = await request('/api/sessions')
assert.equal(anonymousList.response.status, 401)
console.log('Anonymous session access is rejected')

const registration = await request('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    displayName: 'CaptionAI API Smoke',
    email: `smoke-${Date.now()}@example.test`,
    password: `Smoke-${randomUUID()}-Pass`,
  }),
})
assert.equal(registration.response.status, 201)
assert.ok(registration.response.headers.get('set-cookie'), 'registration must set an authentication cookie')
cookie = registration.response.headers.get('set-cookie').split(';', 1)[0]
console.log('POST /api/auth/register passed')

const created = await request('/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: `API smoke test ${new Date().toISOString()}`, language: 'en', status: 'completed' }),
})
assert.equal(created.response.status, 201)
assert.equal(created.body.success, true)
assert.equal(created.body.session.status, 'active', 'server must ignore a client-provided status')
const { _id: sessionId } = created.body.session
console.log('POST /api/sessions passed; client status was ignored')

const list = await request('/api/sessions')
assert.equal(list.response.status, 200)
assert.equal(list.body.success, true)
assert.ok(list.body.sessions.some((session) => session._id === sessionId))
console.log('GET /api/sessions passed')

const details = await request(`/api/sessions/${sessionId}`)
assert.equal(details.response.status, 200)
assert.equal(details.body.session._id, sessionId)
assert.ok(Array.isArray(details.body.transcripts))
console.log('GET /api/sessions/:id passed')

const invalidId = await request('/api/sessions/not-an-object-id')
assert.equal(invalidId.response.status, 400)
assert.equal(invalidId.body.success, false)
console.log('Invalid ObjectId handling passed')

const ended = await request(`/api/sessions/${sessionId}/end`, { method: 'POST' })
assert.equal(ended.response.status, 200)
assert.equal(ended.body.session.status, 'completed')
assert.ok(ended.body.session.endTime)
assert.ok(ended.body.session.duration >= 0)
console.log('POST /api/sessions/:id/end passed')

const endedAgain = await request(`/api/sessions/${sessionId}/end`, { method: 'POST' })
assert.equal(endedAgain.response.status, 409)
console.log('Already-completed handling passed')

console.log(`API smoke checks passed. Created completed sample session: ${sessionId}`)
