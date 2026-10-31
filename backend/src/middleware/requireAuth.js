import AppError from '../utils/AppError.js'
import { readAccessToken, verifyAccessToken } from '../utils/authCrypto.js'

export function requireAuth(req, _res, next) {
  const token = readAccessToken(req)
  if (!token) return next(new AppError('Sign in to continue', 401))

  try {
    req.user = verifyAccessToken(token)
    return next()
  } catch {
    return next(new AppError('Your session has expired. Sign in again.', 401))
  }
}
