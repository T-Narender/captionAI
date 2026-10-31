import Session from '../models/Session.js'
import AppError from '../utils/AppError.js'

export function validateSessionId(sessionId) {
  if (typeof sessionId !== 'string' || !/^[a-f\d]{24}$/i.test(sessionId)) {
    throw new AppError('Invalid session ID', 400)
  }
}

export async function startSession(sessionId, userId) {
  validateSessionId(sessionId)
  const session = await Session.findOne({ _id: sessionId, userId })

  if (!session) {
    throw new AppError('Session not found', 404)
  }
  if (session.status === 'completed') {
    throw new AppError('Session already completed', 409)
  }

  const needsUpdate = session.status !== 'active' || !session.startTime
  session.status = 'active'
  if (!session.startTime) {
    session.startTime = new Date()
  }
  if (needsUpdate) {
    await session.save()
  }

  return session
}

export async function pauseSession(sessionId, userId) {
  validateSessionId(sessionId)
  const session = await Session.findOne({ _id: sessionId, userId })

  if (!session) {
    throw new AppError('Session not found', 404)
  }
  if (session.status === 'completed') {
    throw new AppError('Session already completed', 409)
  }

  if (!session.pausedAt) {
    session.pausedAt = new Date()
    await session.save()
  }
  return session
}

export async function resumeSession(sessionId, userId) {
  validateSessionId(sessionId)
  const session = await Session.findOne({ _id: sessionId, userId })

  if (!session) {
    throw new AppError('Session not found', 404)
  }
  if (session.status === 'completed') {
    throw new AppError('Session already completed', 409)
  }

  if (session.pausedAt) {
    session.pausedDurationMs = Math.max(0, session.pausedDurationMs ?? 0)
      + Math.max(0, Date.now() - session.pausedAt.getTime())
    session.pausedAt = null
    await session.save()
  }
  return session
}

export async function completeSession(sessionId, userId) {
  validateSessionId(sessionId)
  const session = await Session.findOne({ _id: sessionId, userId })

  if (!session) {
    throw new AppError('Session not found', 404)
  }
  if (session.status === 'completed') {
    throw new AppError('Session already completed', 409)
  }

  const endTime = new Date()
  const startTime = session.startTime ?? endTime
  const openPauseMs = session.pausedAt
    ? Math.max(0, endTime.getTime() - session.pausedAt.getTime())
    : 0
  session.pausedDurationMs = Math.max(0, session.pausedDurationMs ?? 0) + openPauseMs
  session.pausedAt = null
  session.status = 'completed'
  session.endTime = endTime
  session.duration = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime() - session.pausedDurationMs) / 1000))
  await session.save()

  return session
}
