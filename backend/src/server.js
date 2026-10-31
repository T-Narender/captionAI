import 'dotenv/config'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app.js'
import { connectDB } from './config/db.js'
import { registerSocketHandlers } from './sockets/socketHandler.js'
import { logger } from './utils/logger.js'
import { assertAuthSecret } from './utils/authCrypto.js'

function getClientOrigins() {
  return (process.env.CLIENT_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

async function verifyWhisperService() {
  const mode = (process.env.AI_SERVICE_MODE ?? 'mock').toLowerCase()
  if (mode !== 'whisper' && mode !== 'groq') return

  const serviceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000'
  try {
    const response = await fetch(new URL('/health', serviceUrl), {
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) throw new Error('health check failed')
    const health = await response.json()
    if (health.ready !== true) throw new Error('model is not ready')
    if (mode === 'groq' && health.speechVAD?.ready !== true) throw new Error('local speech activity model is not ready')
    logger.info('Local Whisper service is ready')
  } catch {
    throw new Error(`AI_SERVICE_MODE=${mode} requires the local Whisper service${mode === 'groq' ? ' and Silero speech activity detection' : ''}. Start ai-service and wait for its health check to report ready before starting the backend.`)
  }
}

async function startServer() {
  const PORT = Number(process.env.PORT ?? 5000)
  const clientOrigins = getClientOrigins()

  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be a valid TCP port number')
  }
  if (clientOrigins.length === 0) {
    throw new Error('CLIENT_URL must contain at least one allowed frontend origin')
  }

  assertAuthSecret()
  await verifyWhisperService()
  await connectDB()

  const app = createApp(clientOrigins)
  const httpServer = createServer(app)
  const io = new Server(httpServer, {
    cors: {
      origin: clientOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 1_100_000,
  })
  registerSocketHandlers(io)

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(PORT, resolve)
  })
  console.log(`Server is running on http://localhost:${PORT}`)

  let shuttingDown = false
  async function shutdown(signal) {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`Received ${signal}; shutting down`)
    io.close()
    await new Promise((resolve) => httpServer.close(resolve))
    const mongoose = await import('mongoose')
    await mongoose.default.disconnect()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

startServer().catch((error) => {
  logger.error('Backend startup failed', error.message)
  process.exitCode = 1
})
