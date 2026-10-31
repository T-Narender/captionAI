import mongoose from 'mongoose'
import Session from '../models/Session.js'
import Transcript from '../models/Transcript.js'
import { completeSession, validateSessionId } from '../services/sessionService.js'
import AppError from '../utils/AppError.js'

const supportedLanguages = new Set(['en', 'hi', 'te'])

export async function createSession(req, res) {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Request body must be a JSON object', 400)
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const language = body.language ?? 'en'

  if (!title || title.length > 120) {
    throw new AppError('Title is required and must be 120 characters or fewer', 400)
  }
  if (typeof language !== 'string' || !supportedLanguages.has(language)) {
    throw new AppError('Language must be one of: en, hi, te', 400)
  }

  // Status and timestamps come from the server; client-supplied values are ignored.
  const session = await Session.create({ userId: req.user.id, title, language, status: 'active', startTime: new Date() })
  res.status(201).json({ success: true, session })
}

export async function getSessions(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  if (search.length > 100) {
    throw new AppError('Search must be 100 characters or fewer', 400)
  }
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const language = typeof req.query.language === 'string' ? req.query.language : ''
  if (language && !supportedLanguages.has(language)) {
    throw new AppError('Language must be one of: en, hi, te', 400)
  }

  const date = typeof req.query.date === 'string' ? req.query.date : ''
  let dateRange
  if (date) {
    const dateStart = new Date(`${date}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(dateStart.getTime()) || dateStart.toISOString().slice(0, 10) !== date) {
      throw new AppError('Date must use the YYYY-MM-DD format', 400)
    }
    const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000)
    dateRange = { $gte: dateStart, $lt: dateEnd }
  }

  const paginationRequested = req.query.page !== undefined || req.query.limit !== undefined
  const parsePositiveInteger = (value, name, fallback) => {
    if (value === undefined) return fallback
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new AppError(`${name} must be a positive integer`, 400)
    }
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new AppError(`${name} must be a positive integer`, 400)
    }
    return parsed
  }
  const page = paginationRequested ? parsePositiveInteger(req.query.page, 'Page', 1) : null
  const limit = paginationRequested ? parsePositiveInteger(req.query.limit, 'Limit', 10) : null
  if (limit > 50) {
    throw new AppError('Limit cannot be greater than 50', 400)
  }

  const ownershipMatch = { userId: new mongoose.Types.ObjectId(req.user.id) }
  const sessionMatch = {}
  if (language) sessionMatch.language = language
  if (dateRange) sessionMatch.startTime = dateRange
  if (escapedSearch) {
    sessionMatch.$or = [
      { title: { $regex: escapedSearch, $options: 'i' } },
      { language: { $regex: escapedSearch, $options: 'i' } },
      { 'transcripts.text': { $regex: escapedSearch, $options: 'i' } },
      { 'transcripts.emotion': { $regex: escapedSearch, $options: 'i' } },
    ]
  }

  const pipeline = [
    { $match: ownershipMatch },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: Transcript.collection.name,
        localField: '_id',
        foreignField: 'sessionId',
        as: 'transcripts',
      },
    },
    ...(Object.keys(sessionMatch).length ? [{ $match: sessionMatch }] : []),
    { $addFields: { captionCount: { $size: '$transcripts' } } },
  ]

  let sessions
  let total
  if (paginationRequested) {
    const [pageResult] = await Session.aggregate([
      ...pipeline,
      {
        $facet: {
          sessions: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          metadata: [{ $count: 'total' }],
        },
      },
    ])
    sessions = pageResult?.sessions ?? []
    total = pageResult?.metadata[0]?.total ?? 0
  } else {
    sessions = await Session.aggregate(pipeline)
    total = sessions.length
  }

  const sessionViews = sessions.map(({ transcripts, ...session }) => {
    const emotionCounts = transcripts.reduce((counts, transcript) => {
      if (transcript.emotion) counts.set(transcript.emotion, (counts.get(transcript.emotion) ?? 0) + 1)
      return counts
    }, new Map())
    const [dominantEmotion, count] = [...emotionCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? []
    return {
      ...session,
      emotionSummary: dominantEmotion ? `${dominantEmotion} · ${count} segment${count === 1 ? '' : 's'}` : 'Not analyzed',
    }
  })
  res.json({
    success: true,
    count: total,
    sessions: sessionViews,
    ...(paginationRequested ? { pagination: { page, limit, total, pages: Math.ceil(total / limit) } } : {}),
  })
}

export async function getRecentTranscripts(req, res) {
  const transcripts = await Session.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
    {
      $lookup: {
        from: Transcript.collection.name,
        localField: '_id',
        foreignField: 'sessionId',
        as: 'transcripts',
      },
    },
    { $unwind: '$transcripts' },
    { $sort: { 'transcripts.createdAt': -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: '$transcripts._id',
        text: '$transcripts.text',
        language: '$transcripts.language',
        emotion: '$transcripts.emotion',
        emotionConfidence: '$transcripts.emotionConfidence',
        createdAt: '$transcripts.createdAt',
        sessionId: '$_id',
        sessionTitle: '$title',
      },
    },
  ])
  res.json({ success: true, transcripts })
}

export async function getSessionById(req, res) {
  validateSessionId(req.params.id)
  const session = await Session.findOne({ _id: req.params.id, userId: req.user.id }).lean()
  if (!session) {
    throw new AppError('Session not found', 404)
  }
  const transcripts = await Transcript.find({ sessionId: session._id }).sort({ startTime: 1 }).lean()

  res.json({ success: true, session, transcripts })
}

export async function updateSessionTitle(req, res) {
  validateSessionId(req.params.id)
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Request body must be a JSON object', 400)
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title || title.length > 120) {
    throw new AppError('Title is required and must be 120 characters or fewer', 400)
  }

  const session = await Session.findOne({ _id: req.params.id, userId: req.user.id })
  if (!session) {
    throw new AppError('Session not found', 404)
  }
  session.title = title
  await session.save()
  res.json({ success: true, session })
}

export async function endSession(req, res) {
  const session = await completeSession(req.params.id, req.user.id)
  res.json({ success: true, session })
}

export async function deleteSession(req, res) {
  validateSessionId(req.params.id)
  const session = await Session.findOne({ _id: req.params.id, userId: req.user.id })
  if (!session) throw new AppError('Session not found', 404)
  if (session.status !== 'completed') {
    throw new AppError('Stop the live session before deleting it', 409)
  }

  // This project also supports standalone local MongoDB, where transactions are unavailable.
  // Remove child transcript rows before the owned session record.
  await Transcript.deleteMany({ sessionId: session._id })
  await Session.deleteOne({ _id: session._id, userId: req.user.id })
  res.json({ success: true, deleted: true, sessionId: String(session._id) })
}
