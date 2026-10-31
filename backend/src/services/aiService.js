import { logger } from '../utils/logger.js'

/**
 * Audio-to-caption adapter.
 * AI_SERVICE_MODE=mock uses sample captions.
 * AI_SERVICE_MODE=whisper uses local Whisper.
 * AI_SERVICE_MODE=groq uses Groq first, then falls back to local Whisper.
 */
export async function processAudioChunk(audioChunk, metadata = {}) {
  const mode = (process.env.AI_SERVICE_MODE ?? 'mock').toLowerCase()
  if (mode === 'groq') return transcribeWithGroqFallback(audioChunk, metadata)
  if (mode !== 'whisper') return createMockCaption(metadata)
  return transcribeLocal(audioChunk, metadata)
}

async function transcribeWithGroqFallback(audioChunk, metadata) {
  if (!hasLikelySpeechPcmWav(audioChunk)) {
    return createNoSpeechResult(metadata)
  }

  try {
    const speechCheck = await checkLocalSpeechActivity(audioChunk, metadata)
    if (!speechCheck.speech) return createNoSpeechResult(metadata)
  } catch (error) {
    logger.warn('Local speech activity check failed; using local Whisper fallback', {
      reason: error.message,
    })
    return transcribeLocalFallback(audioChunk, metadata)
  }

  try {
    if (!process.env.GROQ_API_KEY?.trim()) {
      throw new Error('GROQ_API_KEY is not configured')
    }
    return await transcribeGroq(audioChunk, metadata)
  } catch (error) {
    logger.warn('Groq transcription failed; using local Whisper fallback', {
      reason: error.message,
    })
    return transcribeLocalFallback(audioChunk, metadata)
  }
}

function createNoSpeechResult(metadata) {
  const startTime = Number.isFinite(metadata.startTime) ? metadata.startTime : 0
  return {
    text: '',
    language: metadata.language ?? 'en',
    startTime,
    endTime: startTime,
    source: 'whisper',
    provider: 'silence-filter',
  }
}

async function transcribeLocalFallback(audioChunk, metadata) {
  try {
    return {
      ...(await transcribeLocal(audioChunk, metadata)),
      provider: 'local-whisper-fallback',
    }
  } catch {
    throw new Error('Groq transcription failed and local Whisper fallback is unavailable')
  }
}

async function checkLocalSpeechActivity(audioChunk, metadata) {
  const serviceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000'
  const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/speech-presence`, {
    method: 'POST',
    headers: { 'Content-Type': metadata.mimeType ?? 'audio/wav' },
    body: toBuffer(audioChunk),
    signal: AbortSignal.timeout(2000),
  }).catch((error) => {
    throw new Error(error.name === 'TimeoutError' ? 'Local VAD timed out' : 'Local VAD is unavailable')
  })

  if (!response.ok) throw new Error(`Local VAD returned HTTP ${response.status}`)
  const result = await response.json().catch(() => {
    throw new Error('Local VAD returned an invalid response')
  })
  if (typeof result.speech !== 'boolean') throw new Error('Local VAD response is missing speech status')
  return result
}

async function transcribeGroq(audioChunk, metadata) {
  const audio = toBuffer(audioChunk)
  const mimeType = metadata.mimeType ?? 'audio/wav'
  const extension = mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'wav'
  const form = new FormData()
  form.append('file', new Blob([audio], { type: mimeType }), `audio.${extension}`)
  const language = metadata.language ?? 'en'
  // Use Groq's accuracy-oriented multilingual checkpoint for Hindi/Telugu;
  // English keeps the lower-latency turbo model by default.
  const model = language === 'en'
    ? process.env.GROQ_WHISPER_MODEL ?? 'whisper-large-v3-turbo'
    : process.env.GROQ_MULTILINGUAL_WHISPER_MODEL ?? 'whisper-large-v3'
  form.append('model', model)
  form.append('language', language)
  form.append('response_format', 'json')
  form.append('temperature', '0')

  let response
  try {
    response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(10000),
    })
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' ? 'Groq request timed out' : 'Groq API is unreachable')
  }

  if (!response.ok) {
    // Never include the response body: providers may echo request or account details.
    throw new Error(`Groq API returned HTTP ${response.status}`)
  }

  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('Groq API returned an invalid response')
  }
  if (typeof result.text !== 'string') throw new Error('Groq API response did not contain a transcript')

  const startTime = Number.isFinite(metadata.startTime) ? metadata.startTime : 0
  return {
    text: result.text,
    language,
    startTime,
    endTime: startTime + (Number.isFinite(metadata.duration) ? metadata.duration : 3),
    source: 'whisper',
    provider: 'groq',
  }
}

async function transcribeLocal(audioChunk, metadata = {}) {
  const serviceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000'
  const startTime = Number.isFinite(metadata.startTime) ? metadata.startTime : 0
  const language = metadata.language ?? 'en'
  const mimeType = metadata.mimeType ?? 'application/octet-stream'

  try {
    const response = await fetch(
      `${serviceUrl.replace(/\/$/, '')}/transcribe?language=${encodeURIComponent(language)}&start_time=${encodeURIComponent(startTime)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: toBuffer(audioChunk),
        signal: AbortSignal.timeout(60000),
      },
    )

    if (!response.ok) throw new Error(`AI service returned HTTP ${response.status}`)
    const result = await response.json()
    return { ...result, source: 'whisper', provider: 'local-whisper' }
  } catch (error) {
    const message = error.name === 'TimeoutError'
      ? 'Local transcription timed out. Try a shorter audio chunk.'
      : 'Local transcription service is unavailable or rejected the audio chunk.'
    throw new Error(message)
  }
}

export async function analyzeAudioEmotion(audioChunk, metadata = {}) {
  const mode = (process.env.AI_SERVICE_MODE ?? 'mock').toLowerCase()
  if (mode !== 'whisper' && mode !== 'groq') return null

  const language = metadata.language ?? 'en'
  if (language !== 'en') return { supported: false }

  const serviceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000'
  try {
    const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/emotion?language=${encodeURIComponent(language)}`, {
      method: 'POST',
      headers: { 'Content-Type': metadata.mimeType ?? 'audio/wav' },
      body: toBuffer(audioChunk),
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) throw new Error('Speech emotion service returned an error')
    return await response.json()
  } catch {
    // Do not expose local service URLs, environment values, or request audio.
    throw new Error('Speech emotion analysis is unavailable')
  }
}

function toBuffer(audioChunk) {
  if (Buffer.isBuffer(audioChunk)) return audioChunk
  if (audioChunk instanceof ArrayBuffer) return Buffer.from(audioChunk)
  if (ArrayBuffer.isView(audioChunk)) {
    return Buffer.from(audioChunk.buffer, audioChunk.byteOffset, audioChunk.byteLength)
  }
  if (typeof audioChunk === 'string') return Buffer.from(audioChunk, 'base64')
  throw new Error('Audio chunk format is unsupported')
}

function hasLikelySpeechPcmWav(audioChunk) {
  const audio = toBuffer(audioChunk)
  if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
    return true
  }

  let format = null
  let dataOffset = null
  let dataLength = 0
  for (let offset = 12; offset + 8 <= audio.length;) {
    const chunkId = audio.toString('ascii', offset, offset + 4)
    const chunkLength = audio.readUInt32LE(offset + 4)
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + chunkLength
    if (chunkEnd > audio.length) return true

    if (chunkId === 'fmt ' && chunkLength >= 16) {
      format = {
        encoding: audio.readUInt16LE(chunkStart),
        channels: audio.readUInt16LE(chunkStart + 2),
        sampleRate: audio.readUInt32LE(chunkStart + 4),
        bitsPerSample: audio.readUInt16LE(chunkStart + 14),
      }
    } else if (chunkId === 'data') {
      dataOffset = chunkStart
      dataLength = chunkLength
      break
    }
    offset = chunkEnd + (chunkLength % 2)
  }

  // Leave non-PCM, non-mono, or unfamiliar WAV variants to the provider.
  if (!format || format.encoding !== 1 || format.channels !== 1 || format.bitsPerSample !== 16 || !format.sampleRate || dataOffset === null) {
    return true
  }

  const sampleCount = Math.floor(dataLength / 2)
  if (sampleCount === 0) return false
  const samplesPerFrame = Math.max(1, Math.round(format.sampleRate * 0.02))
  let activeFrames = 0
  let currentRun = 0
  let longestRun = 0

  for (let start = 0; start < sampleCount; start += samplesPerFrame) {
    const end = Math.min(start + samplesPerFrame, sampleCount)
    let squareSum = 0
    for (let index = start; index < end; index += 1) {
      const sample = audio.readInt16LE(dataOffset + index * 2)
      squareSum += sample * sample
    }
    const frameRms = Math.sqrt(squareSum / (end - start)) / 32768
    if (frameRms >= 0.003) {
      activeFrames += 1
      currentRun += 1
      longestRun = Math.max(longestRun, currentRun)
    } else {
      currentRun = 0
    }
  }

  // Match the local Whisper service's gate to avoid captions from mic noise.
  return activeFrames >= 8 && longestRun >= 4
}

function createMockCaption(metadata) {
  const startTime = Number.isFinite(metadata.startTime) ? metadata.startTime : 0
  return {
    text: 'This is a sample caption',
    language: metadata.language ?? 'en',
    startTime,
    endTime: startTime + 2,
    emotion: 'neutral',
    emotionConfidence: 0.85,
    source: 'mock',
  }
}
