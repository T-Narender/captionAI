import mongoose from 'mongoose'
import { logger } from '../utils/logger.js'

export async function connectDB() {
  try {
    const connection = process.env.MONGODB_URI
    if (!connection) {
      throw new Error('MONGODB_URI is required. Add it to backend/.env.')
    }

    await mongoose.connect(connection, { serverSelectionTimeoutMS: 10000 })
    console.log('Connected to MongoDB')
    return mongoose.connection
  } catch (error) {
    const message = error.message?.toLowerCase() ?? ''
    if (error.code === 18 || message.includes('authentication failed') || message.includes('bad auth')) {
      const safeMessage = 'MongoDB authentication failed. Check the MongoDB Database Access credentials and URL-encode reserved characters.'
      logger.error(`Error connecting to MongoDB: ${safeMessage} URI and credentials were not logged.`)
      throw new Error(safeMessage)
    }

    const safeMessage = 'MongoDB connection failed. Check the URI, cluster availability, and Atlas IP access list. URI and credentials were not logged.'
    logger.error(`Error connecting to MongoDB: ${safeMessage}`)
    throw new Error(safeMessage)
  }
}
