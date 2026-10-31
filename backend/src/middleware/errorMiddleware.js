import mongoose from 'mongoose'
import { logger } from '../utils/logger.js'

export function errorMiddleware(error, _req, res, _next) {
  if (res.headersSent) {
    return
  }

  let statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500
  let message = statusCode === 500 ? 'Internal server error' : error.message

  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    statusCode = 400
    message = error.message
  } else if (error?.code === 11000) {
    statusCode = 409
    message = 'A record with this value already exists'
  } else if (error?.type === 'entity.parse.failed') {
    statusCode = 400
    message = 'Request body contains invalid JSON'
  } else if (error?.type === 'entity.too.large') {
    statusCode = 413
    message = 'Request body is too large'
  }

  if (statusCode >= 500) {
    logger.error('Unhandled request error', error)
  }

  const response = { success: false, message }
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    response.stack = error.stack
  }

  res.status(statusCode).json(response)
}
