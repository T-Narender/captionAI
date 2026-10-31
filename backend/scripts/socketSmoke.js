import assert from 'node:assert/strict'
import { io } from 'socket.io-client'

const sessionId = process.argv[2]
if (!sessionId) {
  console.error('Usage: npm run socket:smoke -- <active-session-id>')
  process.exit(1)
}

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:5000'
const authCookie = process.env.AUTH_COOKIE
if (!authCookie) {
  console.error('Set AUTH_COOKIE to the signed-in account cookie before running the socket smoke check.')
  process.exit(1)
}
const socket = io(backendUrl, {
  timeout: 5000,
  reconnection: false,
  withCredentials: true,
  extraHeaders: { Cookie: authCookie },
})

function emitWithAck(event, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${event} acknowledgement timed out`)), 10000)
    socket.emit(event, payload, (response) => {
      clearTimeout(timeout)
      if (!response?.success) reject(new Error(response?.message ?? `${event} failed`))
      else resolve(response)
    })
  })
}

try {
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('connect_error', reject)
  })
  console.log('Socket.IO connection passed')

  const start = await emitWithAck('start_session', { sessionId })
  assert.equal(start.status, 'active')
  console.log('start_session passed')

  const captionEvent = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Mock caption event timed out')), 10000)
    socket.once('caption', (caption) => {
      clearTimeout(timeout)
      resolve(caption)
    })
  })
  const emotionEvent = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Mock emotion event timed out')), 10000)
    socket.once('emotion', (emotion) => {
      clearTimeout(timeout)
      resolve(emotion)
    })
  })
  const chunkAck = emitWithAck('audio_chunk', {
    sessionId,
    audioChunk: Buffer.from('sample audio bytes'),
  })
  const [chunkResult, caption, emotion] = await Promise.all([chunkAck, captionEvent, emotionEvent])
  assert.equal(caption.text, 'This is a sample caption')
  assert.equal(chunkResult.caption.sessionId, sessionId)
  assert.equal(emotion.emotion, 'neutral')
  assert.equal(emotion.confidence, 0.85)
  console.log('audio_chunk, mock caption, and emotion event passed')

  const sessionCompleteEvent = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('session_complete event timed out')), 10000)
    socket.once('session_complete', (session) => {
      clearTimeout(timeout)
      resolve(session)
    })
  })
  const endAck = emitWithAck('end_session', { sessionId })
  const [endResult, completedEvent] = await Promise.all([endAck, sessionCompleteEvent])
  assert.equal(endResult.status, 'completed')
  assert.equal(completedEvent.sessionId, sessionId)
  console.log('end_session and session_complete passed')
} catch (error) {
  console.error(`Socket smoke check failed: ${error.message}`)
  process.exitCode = 1
} finally {
  socket.disconnect()
}
