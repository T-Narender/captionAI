import User from '../models/User.js'
import AppError from '../utils/AppError.js'
import { clearAuthCookie, createAccessToken, hashPassword, setAuthCookie, verifyPassword } from '../utils/authCrypto.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const preferenceOptions = {
  language: ['English', 'Hindi', 'Telugu'],
  fontSize: ['small', 'regular', 'large'],
  density: ['comfortable', 'compact'],
  theme: ['light', 'dark', 'system'],
}
const preferenceBooleans = ['highContrast', 'reducedMotion']
const defaultPreferences = {
  language: 'English', fontSize: 'regular', density: 'comfortable', theme: 'light',
  highContrast: false, reducedMotion: false,
}

function publicUser(user) {
  return {
    id: String(user._id),
    displayName: user.displayName,
    email: user.email,
    createdAt: user.createdAt,
    preferences: { ...defaultPreferences, ...(user.preferences?.toObject?.() ?? user.preferences ?? {}) },
  }
}

function readCredentials(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Request body must be a JSON object', 400)
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!emailPattern.test(email) || email.length > 254) throw new AppError('Enter a valid email address', 400)
  if (password.length < 8 || password.length > 128) throw new AppError('Password must be between 8 and 128 characters', 400)
  return { email, password }
}

export async function register(req, res) {
  const { email, password } = readCredentials(req.body)
  const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : ''
  if (!displayName || displayName.length > 80) throw new AppError('Name is required and must be 80 characters or fewer', 400)

  let user
  try {
    user = await User.create({ displayName, email, passwordHash: await hashPassword(password) })
  } catch (error) {
    if (error?.code === 11000) throw new AppError('An account with this email already exists', 409)
    throw error
  }
  setAuthCookie(res, createAccessToken(user._id))
  res.status(201).json({ success: true, user: publicUser(user) })
}

export async function login(req, res) {
  const { email, password } = readCredentials(req.body)
  const user = await User.findOne({ email }).select('+passwordHash')
  const matches = await verifyPassword(password, user?.passwordHash)
  if (!user || !matches) throw new AppError('Email or password is incorrect', 401)

  setAuthCookie(res, createAccessToken(user._id))
  res.json({ success: true, user: publicUser(user) })
}

export function logout(_req, res) {
  clearAuthCookie(res)
  res.json({ success: true })
}

export async function getCurrentUser(req, res) {
  const user = await User.findById(req.user.id).lean()
  if (!user) throw new AppError('Your account is no longer available', 401)
  res.json({ success: true, user: publicUser(user) })
}

export async function updateProfile(req, res) {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('Request body must be a JSON object', 400)
  const fields = {}
  if (Object.hasOwn(body, 'displayName')) {
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
    if (!displayName || displayName.length > 80) throw new AppError('Name is required and must be 80 characters or fewer', 400)
    fields.displayName = displayName
  }
  if (Object.hasOwn(body, 'preferences')) {
    const preferences = body.preferences
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
      throw new AppError('Preferences must be a JSON object', 400)
    }
    const validated = {}
    for (const [key, value] of Object.entries(preferences)) {
      if (Object.hasOwn(preferenceOptions, key)) {
        if (!preferenceOptions[key].includes(value)) throw new AppError(`Invalid preference: ${key}`, 400)
        validated[key] = value
      } else if (preferenceBooleans.includes(key)) {
        if (typeof value !== 'boolean') throw new AppError(`Invalid preference: ${key}`, 400)
        validated[key] = value
      } else {
        throw new AppError(`Unsupported preference: ${key}`, 400)
      }
    }
    if (Object.keys(validated).length !== Object.keys(defaultPreferences).length) {
      throw new AppError('All account preferences must be provided', 400)
    }
    fields.preferences = validated
  }
  if (!Object.keys(fields).length) throw new AppError('Provide a profile field or preferences to update', 400)
  const user = await User.findByIdAndUpdate(req.user.id, { $set: fields }, { new: true, runValidators: true }).lean()
  if (!user) throw new AppError('Your account is no longer available', 401)
  res.json({ success: true, user: publicUser(user) })
}
