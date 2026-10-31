import { analyzeAudioEmotion, processAudioChunk } from '../services/aiService.js'
import { completeSession, pauseSession, resumeSession, startSession } from '../services/sessionService.js'
import Session from '../models/Session.js'
import Transcript from '../models/Transcript.js'
import AppError from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import { readAccessToken, verifyAccessToken } from '../utils/authCrypto.js'

const MAX_CHUNK_BYTES = 1024 * 1024

function sendSocketError(socket, error, acknowledge) {
  const statusCode = error.statusCode ?? 500
  if (statusCode >= 500) {
    logger.error('Socket event failed', { socketId: socket.id, message: error.message })
  }
  const response = {
    success: false,
    message: statusCode >= 500 && !error.safeForClient
      ? 'Unable to process socket event'
      : error.message,
  }
  socket.emit('error', response)
  if (typeof acknowledge === 'function') acknowledge(response)
}

function getChunkSize(chunk) {
  if (Buffer.isBuffer(chunk)) return chunk.byteLength
  if (chunk instanceof ArrayBuffer) return chunk.byteLength
  if (ArrayBuffer.isView(chunk)) return chunk.byteLength
  if (typeof chunk === 'string') return Buffer.from(chunk, 'base64').byteLength
  return 0
}

function requirePayloadObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError('Event payload must be an object', 400)
  }
  return payload
}

export function registerSocketHandlers(io) {
  const sessionBySocket = new Map()

  io.use((socket, next) => {
    try {
      const token = readAccessToken({ headers: socket.handshake.headers })
      if (!token) throw new Error('Missing authentication')
      socket.data.userId = verifyAccessToken(token).id
      next()
    } catch {
      next(new Error('Authentication required'))
    }
  })

  io.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id })

    socket.on('start_session', async (payload = {}, acknowledge) => {
      try {
        const { sessionId } = requirePayloadObject(payload)
        const session = await startSession(sessionId, socket.data.userId)
        sessionBySocket.set(socket.id, session.id)
        const response = { success: true, sessionId: session.id, status: session.status }
        if (typeof acknowledge === 'function') acknowledge(response)
      } catch (error) {
        sendSocketError(socket, error, acknowledge)
      }
    })

    socket.on('pause_session', async (payload = {}, acknowledge) => {
      try {
        requirePayloadObject(payload)
        const sessionId = payload.sessionId ?? sessionBySocket.get(socket.id)
        if (!sessionId || sessionBySocket.get(socket.id) !== sessionId) {
          throw new AppError('Socket is not connected to this session', 403)
        }

        const session = await pauseSession(sessionId, socket.data.userId)
        const response = { success: true, sessionId: session.id, paused: true }
        if (typeof acknowledge === 'function') acknowledge(response)
      } catch (error) {
        sendSocketError(socket, error, acknowledge)
      }
    })

    socket.on('resume_session', async (payload = {}, acknowledge) => {
      try {
        requirePayloadObject(payload)
        const sessionId = payload.sessionId ?? sessionBySocket.get(socket.id)
        if (!sessionId || sessionBySocket.get(socket.id) !== sessionId) {
          throw new AppError('Socket is not connected to this session', 403)
        }

        const session = await resumeSession(sessionId, socket.data.userId)
        const response = { success: true, sessionId: session.id, paused: false }
        if (typeof acknowledge === 'function') acknowledge(response)
      } catch (error) {
        sendSocketError(socket, error, acknowledge)
      }
    })

    socket.on('audio_chunk', async (payload = {}, acknowledge) => {
      try {
        requirePayloadObject(payload)
        const sessionId = payload.sessionId ?? sessionBySocket.get(socket.id)
        if (!sessionId || sessionBySocket.get(socket.id) !== sessionId) {
          throw new AppError('Socket is not connected to this session', 403)
        }

        const session = await Session.findOne({ _id: sessionId, userId: socket.data.userId })
        if (!session) throw new AppError('Session not found', 404)
        if (session.status !== 'active') throw new AppError('Session already completed', 409)

        const audioChunk = payload.audioChunk ?? payload.chunk
        const chunkSize = getChunkSize(audioChunk)
        if (chunkSize <= 0) throw new AppError('Audio chunk is required', 400)
        if (chunkSize > MAX_CHUNK_BYTES) throw new AppError('Audio chunk must be 1 MB or smaller', 413)
        const emotionChunk = payload.emotionChunk ?? audioChunk
        const emotionChunkSize = getChunkSize(emotionChunk)
        if (emotionChunkSize <= 0 || emotionChunkSize > MAX_CHUNK_BYTES) {
          throw new AppError('Emotion audio chunk must be between 1 byte and 1 MB', 413)
        }

        logger.info('Audio chunk received', { socketId: socket.id, sessionId, chunkSize })
        const emotionMetadata = { language: session.language, mimeType: payload.mimeType }
        const startEmotionAnalysis = () => analyzeAudioEmotion(emotionChunk, emotionMetadata)
          .then((emotionResult) => ({ emotionResult }), (emotionError) => ({ emotionError }))
        // Groq ASR runs remotely, so SER can use the same audio concurrently and
        // be ready near the transcript. Keep local Whisper sequential to avoid
        // CPU contention delaying the caption itself.
        const pendingEmotion = (process.env.AI_SERVICE_MODE ?? 'mock').toLowerCase() === 'groq'
          ? startEmotionAnalysis()
          : null
        let result
        try {
          result = await processAudioChunk(audioChunk, {
            sessionId,
            language: session.language,
            startTime: payload.startTime,
            duration: payload.duration,
            mimeType: payload.mimeType,
          })
        } catch (error) {
          const safeError = new AppError(error.message, 503)
          safeError.safeForClient = true
          throw safeError
        }
        if (!result.text?.trim()) {
          if (typeof acknowledge === 'function') acknowledge({ success: true, noSpeech: true })
          return
        }
        const caption = {
          sessionId,
          ...result,
          ...(result.source === 'whisper'
            ? { emotionPending: session.language === 'en', emotionUnsupported: session.language !== 'en' }
            : {}),
        }

        if (result.source === 'whisper') {
          const transcript = await Transcript.create({
            sessionId,
            text: result.text,
            language: result.language,
            provider: result.provider,
            startTime: result.startTime,
            endTime: result.endTime,
            ...(result.emotion ? { emotion: result.emotion } : {}),
            ...(Number.isFinite(result.emotionConfidence) ? { emotionConfidence: result.emotionConfidence } : {}),
          })
          caption.transcriptId = transcript.id
        }

        // Mock captions stay transient; real Whisper captions are stored for session history.
        socket.emit(result.isFinal === false ? 'caption_update' : 'caption', caption)
        if (result.source === 'whisper') {
          if (typeof acknowledge === 'function') acknowledge({ success: true, caption })

          // SER can finish before or after the caption; both results are joined
          // by transcriptId so the emoji always updates the correct caption.
          void (pendingEmotion ?? startEmotionAnalysis()).then(async ({ emotionResult, emotionError }) => {
            if (emotionError) {
              logger.warn('Speech emotion analysis failed', { socketId: socket.id, sessionId })
              if (socket.connected) {
                socket.emit('caption_update', {
                  sessionId,
                  transcriptId: caption.transcriptId,
                  emotionPending: false,
                  emotionUnavailable: true,
                })
              }
              return
            }
            if (!emotionResult) return
            if (emotionResult.modelComparison) {
              logger.info('SER model comparison', {
                sessionId,
                transcriptId: caption.transcriptId,
                existing: emotionResult.modelComparison.existing,
                existingScores: emotionResult.modelComparison.existing?.scores,
                speechbrain: emotionResult.modelComparison.speechbrain,
                agreement: emotionResult.modelComparison.agreement,
              })
            }
            if (emotionResult.supported === false) {
              if (socket.connected) {
                socket.emit('caption_update', {
                  sessionId,
                  transcriptId: caption.transcriptId,
                  emotionPending: false,
                  emotionUnsupported: true,
                })
              }
              return
            }

            const emotionConfidence = Number(emotionResult.emotionConfidence)
            if (!emotionResult.emotion || !Number.isFinite(emotionConfidence)) {
              if (socket.connected) {
                socket.emit('caption_update', {
                  sessionId,
                  transcriptId: caption.transcriptId,
                  emotionPending: false,
                  emotionUncertain: emotionResult.uncertain !== false,
                })
              }
              return
            }

            const updatedTranscript = await Transcript.findOneAndUpdate(
              { _id: caption.transcriptId, sessionId },
              { $set: { emotion: emotionResult.emotion, emotionConfidence } },
              { new: true },
            )
            if (!updatedTranscript) return

            const emotionUpdate = {
              sessionId,
              transcriptId: caption.transcriptId,
              emotion: emotionResult.emotion,
              emotionConfidence,
              confidence: emotionConfidence,
              emotionPending: false,
            }
            if (socket.connected) {
              socket.emit('caption_update', emotionUpdate)
              socket.emit('emotion', {
                sessionId,
                transcriptId: caption.transcriptId,
                emotion: emotionResult.emotion,
                confidence: emotionConfidence,
                startTime: result.startTime,
                endTime: result.endTime,
              })
            }
          }).catch(() => {
            logger.warn('Speech emotion update failed', { socketId: socket.id, sessionId })
          })
          return
        }
        if (result.emotion) {
          socket.emit('emotion', {
            sessionId,
            emotion: result.emotion,
            confidence: result.emotionConfidence,
            startTime: result.startTime,
            endTime: result.endTime,
          })
        }
        if (typeof acknowledge === 'function') acknowledge({ success: true, caption })
      } catch (error) {
        sendSocketError(socket, error, acknowledge)
      }
    })

    socket.on('end_session', async (payload = {}, acknowledge) => {
      try {
        const { sessionId: requestedSessionId } = requirePayloadObject(payload)
        const sessionId = requestedSessionId ?? sessionBySocket.get(socket.id)
        if (!sessionId || sessionBySocket.get(socket.id) !== sessionId) {
          throw new AppError('Socket is not connected to this session', 403)
        }

        const session = await completeSession(sessionId, socket.data.userId)
        sessionBySocket.delete(socket.id)
        const response = {
          sessionId: session.id,
          status: session.status,
          duration: session.duration,
        }
        socket.emit('session_complete', response)
        if (typeof acknowledge === 'function') acknowledge({ success: true, ...response })
      } catch (error) {
        sendSocketError(socket, error, acknowledge)
      }
    })

    socket.on('disconnect', (reason) => {
      sessionBySocket.delete(socket.id)
      logger.info('Socket disconnected', { socketId: socket.id, reason })
    })
  })
}
