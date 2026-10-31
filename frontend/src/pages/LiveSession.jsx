import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Link } from 'react-router-dom'
import AppShell from '../components/layout/AppShell.jsx'
import CaptionDisplay from '../components/captions/CaptionDisplay.jsx'
import CaptionHistory from '../components/captions/CaptionHistory.jsx'
import EmotionPanel from '../components/emotion/EmotionPanel.jsx'
import RecordingIndicator from '../components/session/RecordingIndicator.jsx'
import SessionControls from '../components/session/SessionControls.jsx'
import { API_BASE_URL, createSession, endSession } from '../utils/api.js'
import { readPreferences } from '../utils/preferences.js'
import { useAuth } from '../context/AuthContext.jsx'

const languageNames = { en: 'English', hi: 'Hindi', te: 'Telugu' }
// Longer chunks give multilingual ASR more phrase context, at a small latency cost.
const ENGLISH_AUDIO_CHUNK_SECONDS = 3
const MULTILINGUAL_AUDIO_CHUNK_SECONDS = 10
// SER is utterance-level; analyze the most recent six seconds of speech.
const EMOTION_CONTEXT_SECONDS = 6
const TRANSCRIPTION_SAMPLE_RATE = 16000

function encodePcmWav(samples, sourceSampleRate) {
  const outputLength = Math.floor(samples.length * TRANSCRIPTION_SAMPLE_RATE / sourceSampleRate)
  const buffer = new ArrayBuffer(44 + outputLength * 2)
  const view = new DataView(buffer)
  const writeText = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)))

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + outputLength * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, TRANSCRIPTION_SAMPLE_RATE, true)
  view.setUint32(28, TRANSCRIPTION_SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, outputLength * 2, true)

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * sourceSampleRate / TRANSCRIPTION_SAMPLE_RATE
    const leftIndex = Math.floor(sourceIndex)
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1)
    const fraction = sourceIndex - leftIndex
    const sample = samples[leftIndex] * (1 - fraction) + samples[rightIndex] * fraction
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  }
  return buffer
}

function mergeAudioBlocks(blocks, sampleCount) {
  const merged = new Float32Array(sampleCount)
  let offset = 0
  blocks.forEach((block) => { merged.set(block, offset); offset += block.length })
  return merged
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function waitForConnection(socket) {
  return new Promise((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('connect_error', reject)
    socket.connect()
  })
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (result) => {
      if (result?.success) resolve(result)
      else reject(new Error(result?.message || `Could not ${event.replaceAll('_', ' ')}`))
    })
  })
}

export default function LiveSession() {
  const { user } = useAuth()
  const preferences = useMemo(() => readPreferences(user.id, user.preferences), [user.id, user.preferences])
  const [status, setStatus] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [session, setSession] = useState(null)
  const [sessionTitle, setSessionTitle] = useState('')
  const [captions, setCaptions] = useState([])
  const [currentCaption, setCurrentCaption] = useState(null)
  const [error, setError] = useState('')
  const socketRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioProcessorRef = useRef(null)
  const audioSourceRef = useRef(null)
  const audioBlocksRef = useRef([])
  const audioSampleCountRef = useRef(0)
  const audioCapturedDurationRef = useRef(0)
  const emotionBlocksRef = useRef([])
  const emotionSampleCountRef = useRef(0)
  const pendingChunksRef = useRef(new Set())
  const sessionRef = useRef(null)
  const statusRef = useRef(status)
  const elapsedRef = useRef(0)

  useEffect(() => { elapsedRef.current = elapsed }, [elapsed])
  useEffect(() => { statusRef.current = status }, [status])

  useEffect(() => {
    if (status !== 'recording') return undefined
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => () => {
    audioProcessorRef.current?.disconnect()
    audioSourceRef.current?.disconnect()
    void audioContextRef.current?.close()
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    socketRef.current?.disconnect()
    if (sessionRef.current && statusRef.current !== 'stopped') {
      void endSession(sessionRef.current._id).catch(() => {})
    }
  }, [])

  async function startSession() {
    setError('')
    if (status === 'paused') {
      const socket = socketRef.current
      if (!socket?.connected) {
        setError('Connection to the backend was lost. Stop this session before starting another one.')
        return
      }
      setStatus('resuming')
      let resumedOnServer = false
      try {
        await emitWithAck(socket, 'resume_session', { sessionId: session?._id })
        resumedOnServer = true
        await audioContextRef.current?.resume()
        setStatus('recording')
      } catch (resumeError) {
        if (resumedOnServer) {
          try { await emitWithAck(socket, 'pause_session', { sessionId: session?._id }) } catch { /* preserve the resume error */ }
        }
        setStatus('paused')
        setError(resumeError.message || 'Could not resume the session.')
      }
      return
    }

    setStatus('connecting')
    setCaptions([])
    setCurrentCaption(null)
    setSession(null)
    setElapsed(0)

    let createdSession
    let socket
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
        throw new Error('This browser does not support microphone audio capture.')
      }
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      await audioContext.resume()
      const savedPreferences = readPreferences(user.id, user.preferences)
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
        ...(savedPreferences.microphoneId && savedPreferences.microphoneId !== 'default'
          ? { deviceId: { ideal: savedPreferences.microphoneId } }
          : {}),
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      })
      mediaStreamRef.current = stream

      const lang = savedPreferences.language === 'Hindi' ? 'hi' : savedPreferences.language === 'Telugu' ? 'te' : 'en'
      const title = sessionTitle.trim().slice(0, 120) || `Live session · ${new Date().toLocaleString()}`
      createdSession = await createSession({ title, language: lang })
      setSessionTitle(createdSession.title)
      setSession(createdSession)
      sessionRef.current = createdSession

      socket = io(API_BASE_URL, { autoConnect: false, withCredentials: true, transports: ['websocket', 'polling'] })
      socketRef.current = socket
      socket.on('caption', (payload) => {
        const entry = {
          ...payload,
          id: `${Date.now()}-${Math.random()}`,
          language: languageNames[payload.language] ?? payload.language,
          confidence: payload.emotionConfidence ?? payload.confidence ?? 0,
        }
        setCurrentCaption(entry)
        setCaptions((items) => [entry, ...items])
      })
      socket.on('caption_update', (payload) => {
        const applyUpdate = (current) => ({
          ...current,
          ...payload,
          confidence: payload.emotionConfidence ?? payload.confidence ?? current.confidence ?? 0,
          language: payload.language
            ? languageNames[payload.language] ?? payload.language
            : current.language,
        })
        setCurrentCaption((current) => (
          current && (!payload.transcriptId || current.transcriptId === payload.transcriptId)
            ? applyUpdate(current)
            : current
        ))
        if (payload.transcriptId) {
          setCaptions((items) => items.map((item) => (
            item.transcriptId === payload.transcriptId ? applyUpdate(item) : item
          )))
        }
      })
      socket.on('error', (payload) => setError(payload?.message || 'A live session error occurred.'))

      await waitForConnection(socket)
      await emitWithAck(socket, 'start_session', { sessionId: createdSession._id })

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      audioSourceRef.current = source
      audioProcessorRef.current = processor
      audioBlocksRef.current = []
      audioSampleCountRef.current = 0
      audioCapturedDurationRef.current = 0
      emotionBlocksRef.current = []
      emotionSampleCountRef.current = 0
      const chunkTargetSeconds = lang === 'en' ? ENGLISH_AUDIO_CHUNK_SECONDS : MULTILINGUAL_AUDIO_CHUNK_SECONDS
      const sendChunk = (audioChunk, emotionChunk, startTime, duration) => {
        if (!socket.connected) return
        const operation = emitWithAck(socket, 'audio_chunk', {
          sessionId: createdSession._id,
          audioChunk,
          emotionChunk,
          startTime,
          duration,
          mimeType: 'audio/wav',
        })
        pendingChunksRef.current.add(operation)
        operation.catch((chunkError) => {
          setError(chunkError.message || 'Could not send microphone audio to the backend.')
        }).finally(() => {
          pendingChunksRef.current.delete(operation)
        })
      }
      processor.onaudioprocess = (event) => {
        const samples = event.inputBuffer.getChannelData(0)
        const copy = new Float32Array(samples)
        audioCapturedDurationRef.current += copy.length / audioContext.sampleRate
        audioBlocksRef.current.push(copy)
        audioSampleCountRef.current += copy.length
        emotionBlocksRef.current.push(copy)
        emotionSampleCountRef.current += copy.length
        const maxEmotionSamples = Math.round(audioContext.sampleRate * EMOTION_CONTEXT_SECONDS)
        while (emotionSampleCountRef.current > maxEmotionSamples && emotionBlocksRef.current.length) {
          const excessSamples = emotionSampleCountRef.current - maxEmotionSamples
          const oldestBlock = emotionBlocksRef.current[0]
          if (oldestBlock.length <= excessSamples) {
            emotionBlocksRef.current.shift()
            emotionSampleCountRef.current -= oldestBlock.length
          } else {
            emotionBlocksRef.current[0] = oldestBlock.slice(excessSamples)
            emotionSampleCountRef.current -= excessSamples
          }
        }
        event.outputBuffer.getChannelData(0).fill(0)

        if (audioSampleCountRef.current >= audioContext.sampleRate * chunkTargetSeconds) {
          const completeAudio = mergeAudioBlocks(audioBlocksRef.current, audioSampleCountRef.current)
          const duration = completeAudio.length / audioContext.sampleRate
          const startTime = Math.max(0, audioCapturedDurationRef.current - duration)
          audioBlocksRef.current = []
          audioSampleCountRef.current = 0
          const emotionAudio = mergeAudioBlocks(emotionBlocksRef.current, emotionSampleCountRef.current)
          sendChunk(
            encodePcmWav(completeAudio, audioContext.sampleRate),
            encodePcmWav(emotionAudio, audioContext.sampleRate),
            startTime,
            duration,
          )
        }
      }
      source.connect(processor)
      processor.connect(audioContext.destination)
      setStatus('recording')
    } catch (startError) {
      audioProcessorRef.current?.disconnect()
      audioSourceRef.current?.disconnect()
      await audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
      audioProcessorRef.current = null
      audioSourceRef.current = null
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
      socket?.disconnect()
      socketRef.current = null
      if (createdSession?._id) {
        try { await endSession(createdSession._id) } catch { /* retain the original connection error */ }
      }
      sessionRef.current = null
      setSession(null)
      setStatus('idle')
      setError(startError.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow microphone access in your browser and try again.'
        : startError.message || 'Could not start the session.')
    }
  }

  async function stopSession() {
    if (status === 'stopped' || status === 'idle') return
    setStatus('stopping')
    const socket = socketRef.current
    try {
      audioProcessorRef.current?.disconnect()
      audioSourceRef.current?.disconnect()
      const context = audioContextRef.current
      if (context && audioSampleCountRef.current > 0) {
        const finalAudio = mergeAudioBlocks(audioBlocksRef.current, audioSampleCountRef.current)
        if (finalAudio.length >= context.sampleRate * 0.5) {
          const audioChunk = encodePcmWav(finalAudio, context.sampleRate)
          const emotionAudio = mergeAudioBlocks(emotionBlocksRef.current, emotionSampleCountRef.current)
          const duration = finalAudio.length / context.sampleRate
          const startTime = Math.max(0, audioCapturedDurationRef.current - duration)
          const operation = emitWithAck(socket, 'audio_chunk', {
            sessionId: session._id,
            audioChunk,
            emotionChunk: encodePcmWav(emotionAudio, context.sampleRate),
            startTime,
            duration,
            mimeType: 'audio/wav',
          })
          pendingChunksRef.current.add(operation)
          operation.then(
            () => pendingChunksRef.current.delete(operation),
            (chunkError) => {
              pendingChunksRef.current.delete(operation)
              setError(chunkError.message || 'Could not send the final microphone audio chunk.')
            },
          )
        }
      }
      await context?.close()
      audioContextRef.current = null
      audioProcessorRef.current = null
      audioSourceRef.current = null
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
      await Promise.allSettled([...pendingChunksRef.current])
      if (socket?.connected && session?._id) {
        await emitWithAck(socket, 'end_session', { sessionId: session._id })
      } else if (session?._id) {
        await endSession(session._id)
      }
    } catch (stopError) {
      setError(stopError.message || 'Could not save the completed session.')
      if (session?._id) {
        try { await endSession(session._id) } catch { /* keep the visible socket error */ }
      }
    } finally {
      socket?.disconnect()
      socketRef.current = null
      sessionRef.current = null
      setSessionTitle('')
      setStatus('stopped')
    }
  }

  async function pauseSession() {
    const socket = socketRef.current
    if (!socket?.connected || !session?._id) {
      setError('Connection to the backend was lost. The session could not be paused.')
      return
    }

    setStatus('pausing')
    setError('')
    let pausedOnServer = false
    try {
      await emitWithAck(socket, 'pause_session', { sessionId: session._id })
      pausedOnServer = true
      await audioContextRef.current?.suspend()
      setStatus('paused')
    } catch (pauseError) {
      if (pausedOnServer) {
        try { await emitWithAck(socket, 'resume_session', { sessionId: session._id }) } catch { /* preserve the pause error */ }
      }
      setStatus('recording')
      setError(pauseError.message || 'Could not pause the session.')
    }
  }

  const previousCaptions = useMemo(() => captions.slice(1, 4), [captions])
  const recentEmotions = useMemo(() => captions.filter((item) => item.emotion).slice(0, 4), [captions])
  const language = languageNames[session?.language] ?? 'English'
  const providerLabels = {
    groq: 'Groq Whisper',
    'local-whisper': 'Local Whisper',
    'local-whisper-fallback': 'Local Whisper fallback',
  }
  const sourceLabel = currentCaption
    ? providerLabels[currentCaption.provider] ?? (currentCaption.source === 'mock' ? 'Backend mock' : 'Local Whisper')
    : 'Waiting for first caption'

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <Link to="/dashboard" className="text-sm font-medium text-muted hover:text-brand focus-visible:outline-offset-2">← Dashboard</Link>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{session?.title ?? 'Live captioning session'}</h1>
              <RecordingIndicator status={status === 'connecting' ? 'paused' : status === 'stopping' ? 'paused' : status} />
            </div>
            <p className="mt-2 text-sm text-muted">{session ? `Session · ${language} · ${sourceLabel}` : 'Start a session to connect to the backend.'}</p>
            {(status === 'idle' || status === 'stopped') && (
              <label htmlFor="session-title" className="mt-4 block max-w-xl">
                <span className="mb-1.5 block text-xs font-medium text-muted">Session title <span className="font-normal text-subtle">(optional)</span></span>
                <input
                  id="session-title"
                  type="text"
                  maxLength={120}
                  value={sessionTitle}
                  onChange={(event) => setSessionTitle(event.target.value)}
                  placeholder="e.g. Project planning meeting"
                  className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
            )}
          </div>
          <div className="rounded-md border border-caution/30 bg-caution-soft px-3 py-2 text-xs leading-5 text-caution">
            Audio chunks go to the selected transcription service; CaptionAI does not save recordings
          </div>
        </header>

        {error && <div role="alert" className="rounded-md border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical">{error}</div>}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0 space-y-6">
            <CaptionDisplay caption={currentCaption} status={status === 'idle' || status === 'connecting' ? 'paused' : status} fontSize={preferences.fontSize} density={preferences.density} />
            <CaptionHistory captions={previousCaptions} density={preferences.density} />
          </div>

          <aside aria-label="Session information" className="space-y-4">
            <EmotionPanel caption={currentCaption} recentEmotions={recentEmotions} />
            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="text-sm font-semibold text-ink">Session information</h2>
              <dl className="mt-4 divide-y divide-line text-sm">
                <div className="flex justify-between gap-3 py-3 first:pt-0"><dt className="text-muted">Language</dt><dd className="font-medium text-ink">{language}</dd></div>
                <div className="flex justify-between gap-3 py-3"><dt className="text-muted">Duration</dt><dd className="font-medium tabular-nums text-ink">{formatDuration(elapsed)}</dd></div>
                <div className="flex justify-between gap-3 py-3"><dt className="text-muted">Caption source</dt><dd className="font-medium text-ink">{sourceLabel}</dd></div>
                <div className="flex justify-between gap-3 py-3 last:pb-0"><dt className="text-muted">Microphone</dt><dd className="font-medium text-caution">{status === 'recording' || status === 'paused' ? 'Connected' : 'Not connected'}</dd></div>
              </dl>
            </section>
          </aside>
        </div>

        <SessionControls status={status} elapsed={elapsed} onStart={startSession} onPause={pauseSession} onStop={stopSession} />
      </div>
    </AppShell>
  )
}
