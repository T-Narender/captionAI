import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import sessionRoutes from './routes/sessionRoutes.js'
import authRoutes from './routes/authRoutes.js'
import { errorMiddleware } from './middleware/errorMiddleware.js'
import { notFoundMiddleware } from './middleware/notFoundMiddleware.js'
import AppError from './utils/AppError.js'

export function createApp(clientOrigins = []) {
  const app = express()
  const originSet = new Set(clientOrigins)

  const corsOptions = {
    credentials: true,
    origin(origin, callback) {
      if (!origin || originSet.has(origin)) {
        callback(null, true)
        return
      }
      callback(new AppError('Origin not allowed by CORS', 403))
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  }

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors(corsOptions))
  app.use(express.json({ limit: '1mb' }))
  app.use(morgan('tiny'))

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'CaptionAI backend is running' })
  })
  app.use('/api/auth', authRoutes)
  app.use('/api/sessions', sessionRoutes)
  app.use(notFoundMiddleware)
  app.use(errorMiddleware)

  return app
}
