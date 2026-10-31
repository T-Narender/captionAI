import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(nodeScrypt)
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 7
const TOKEN_COOKIE = 'captionai_session'

export function assertAuthSecret() {
  const secret = process.env.JWT_SECRET
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
    throw new Error('Set your own private JWT_SECRET of at least 32 bytes in backend/.env.')
  }
}

function getSecret() {
  assertAuthSecret()
  return process.env.JWT_SECRET
}

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false
  const [saltHex, keyHex] = storedHash.split(':')
  if (!/^[a-f\d]{32}$/i.test(saltHex ?? '') || !/^[a-f\d]{128}$/i.test(keyHex ?? '')) return false
  const expected = Buffer.from(keyHex, 'hex')
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 })
  return timingSafeEqual(expected, actual)
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function createAccessToken(userId) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' })
  const payload = encodeJson({ sub: String(userId), iat: issuedAt, exp: issuedAt + TOKEN_LIFETIME_SECONDS })
  const content = `${header}.${payload}`
  const signature = createHmac('sha256', getSecret()).update(content).digest('base64url')
  return `${content}.${signature}`
}

export function verifyAccessToken(token) {
  if (typeof token !== 'string') throw new Error('Invalid session')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid session')
  const [headerPart, payloadPart, signaturePart] = parts
  const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'))
  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('Invalid session')

  const expected = createHmac('sha256', getSecret()).update(`${headerPart}.${payloadPart}`).digest()
  const actual = Buffer.from(signaturePart, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid session')

  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
  if (typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub) || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Invalid session')
  }
  return { id: payload.sub }
}

export function readAccessToken(req) {
  const cookieHeader = req.headers.cookie ?? ''
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=')
    if (separator < 0 || item.slice(0, separator).trim() !== TOKEN_COOKIE) continue
    try {
      return decodeURIComponent(item.slice(separator + 1).trim())
    } catch {
      return ''
    }
  }
  return ''
}

export function setAuthCookie(res, token) {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_LIFETIME_SECONDS * 1000,
  })
}

export function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}

export { TOKEN_COOKIE }
