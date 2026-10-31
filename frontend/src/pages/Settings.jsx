import { useEffect, useRef, useState } from 'react'
import AppShell from '../components/layout/AppShell.jsx'
import { applyGlobalPreferences, readPreferences, savePreferences } from '../utils/preferences.js'
import { useAuth } from '../context/AuthContext.jsx'

function SettingRow({ title, description, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="max-w-lg">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      </div>
      <div className="shrink-0 sm:w-56">{children}</div>
    </div>
  )
}

function SelectControl({ label, value, options, onChange, id }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      >
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
}

function PreferenceToggle({ id, checked, onChange, label }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md border border-line bg-surface px-3 py-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-brand focus-visible:outline-offset-4"
      />
    </label>
  )
}

export default function Settings() {
  const { user, updatePreferences } = useAuth()
  const [settings, setSettings] = useState(() => readPreferences(user.id, user.preferences))
  const [microphones, setMicrophones] = useState([])
  const [microphoneMessage, setMicrophoneMessage] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const hasChangedPreferences = useRef(false)

  useEffect(() => {
    applyGlobalPreferences(settings)
    savePreferences(settings, user.id)
    if (!hasChangedPreferences.current) return undefined

    setSaveStatus('saving')
    const { microphoneId: _deviceOnly, ...accountPreferences } = settings
    const timer = window.setTimeout(() => {
      updatePreferences(accountPreferences)
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [settings, user.id])

  useEffect(() => {
    let active = true
    const refreshMicrophones = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) {
        if (active) setMicrophoneMessage('Microphone selection is unavailable in this browser.')
        return
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (active) setMicrophones(devices.filter((device) => device.kind === 'audioinput'))
      } catch {
        if (active) setMicrophoneMessage('Could not load microphone devices.')
      }
    }

    void refreshMicrophones()
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshMicrophones)
    return () => {
      active = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshMicrophones)
    }
  }, [])

  function update(key, value) {
    hasChangedPreferences.current = true
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function enableMicrophoneAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophoneMessage('Microphone access is unavailable in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMicrophones(devices.filter((device) => device.kind === 'audioinput'))
      setMicrophoneMessage('Microphones are ready to select.')
    } catch (error) {
      setMicrophoneMessage(error.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow it in your browser settings, then try again.'
        : 'Could not access the microphone. Check that it is connected and try again.')
    }
  }

  const previewTextSize = settings.fontSize === 'small' ? 'text-base' : settings.fontSize === 'large' ? 'text-3xl' : 'text-2xl'
  const previewSpacing = settings.density === 'compact' ? 'py-3' : 'py-6'

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-7">
        <header>
          <p className="text-meta font-semibold uppercase tracking-[0.1em] text-brand">Workspace preferences</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Adjust how captions appear and how this interface works for you.</p>
          <p className="mt-2 min-h-5 text-xs text-subtle" role="status" aria-live="polite">
            {saveStatus === 'saving' ? 'Saving your preferences…' : saveStatus === 'saved' ? 'Preferences saved to your account.' : saveStatus === 'error' ? 'Could not sync account preferences. Your microphone choice remains saved on this device.' : 'Preferences are saved to your account.'}
          </p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)]">
          <div className="space-y-6">
            <section aria-labelledby="caption-settings-heading" className="rounded-lg border border-line bg-surface px-5 sm:px-6">
              <div className="border-b border-line py-5">
                <h2 id="caption-settings-heading" className="text-base font-semibold text-ink">Caption preferences</h2>
                <p className="mt-1 text-sm text-muted">Choose a starting point for your caption sessions.</p>
              </div>
              <SettingRow title="Preferred language" description="Used as the default language when starting a session.">
                <SelectControl label="Preferred language" value={settings.language} onChange={(value) => update('language', value)} options={[
                  ['English', 'English'], ['Hindi', 'Hindi · हिन्दी'], ['Telugu', 'Telugu · తెలుగు'],
                ]} />
              </SettingRow>
              <SettingRow title="Caption font size" description="Change the text size used in the caption workspace.">
                <SelectControl label="Caption font size" value={settings.fontSize} onChange={(value) => update('fontSize', value)} options={[
                  ['small', 'Small'], ['regular', 'Regular'], ['large', 'Large'],
                ]} />
              </SettingRow>
              <SettingRow title="Caption density" description="Choose more breathing room or a compact transcript view.">
                <SelectControl label="Caption density" value={settings.density} onChange={(value) => update('density', value)} options={[
                  ['comfortable', 'Comfortable'], ['compact', 'Compact'],
                ]} />
              </SettingRow>
            </section>

            <section aria-labelledby="display-settings-heading" className="rounded-lg border border-line bg-surface px-5 sm:px-6">
              <div className="border-b border-line py-5">
                <h2 id="display-settings-heading" className="text-base font-semibold text-ink">Display and accessibility</h2>
                <p className="mt-1 text-sm text-muted">Tune the interface to your viewing preferences.</p>
              </div>
              <SettingRow title="Theme" description="Use a light or dark appearance, or follow your device setting.">
                <SelectControl label="Theme" value={settings.theme} onChange={(value) => update('theme', value)} options={[
                  ['light', 'Light'], ['dark', 'Dark'], ['system', 'System'],
                ]} />
              </SettingRow>
              <SettingRow title="Higher contrast" description="Strengthen text and border contrast across the interface.">
                <PreferenceToggle id="high-contrast" label="Enable higher contrast" checked={settings.highContrast} onChange={(value) => update('highContrast', value)} />
              </SettingRow>
              <SettingRow title="Reduced motion" description="Limit interface animation and transition effects.">
                <PreferenceToggle id="reduced-motion" label="Reduce motion" checked={settings.reducedMotion} onChange={(value) => update('reducedMotion', value)} />
              </SettingRow>
            </section>

            <section aria-labelledby="microphone-heading" className="rounded-lg border border-line bg-surface px-5 py-5 sm:px-6">
              <h2 id="microphone-heading" className="text-base font-semibold text-ink">Microphone</h2>
              <p className="mt-1 text-sm text-muted">Choose the input used when you start a live session.</p>
              <label className="mt-4 block max-w-xl">
                <span className="sr-only">Microphone input</span>
                <select
                  id="microphone-input"
                  value={settings.microphoneId}
                  onChange={(event) => update('microphoneId', event.target.value)}
                  className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="default">System default microphone</option>
                  {settings.microphoneId !== 'default' && !microphones.some((device) => device.deviceId === settings.microphoneId) && (
                    <option value={settings.microphoneId}>Previously selected microphone (unavailable)</option>
                  )}
                  {microphones.filter((device) => device.deviceId !== 'default').map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={enableMicrophoneAccess}
                className="mt-3 min-h-10 rounded-md border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-subtle focus-visible:outline-offset-2"
              >
                Allow access and refresh devices
              </button>
              <p className="mt-2 text-xs leading-5 text-subtle" role="status" aria-live="polite">
                {microphoneMessage || (microphones.some((device) => device.label)
                  ? 'The selected microphone will be used for the next session.'
                  : 'Allow microphone access to show device names. You can also keep the system default.')}
              </p>
            </section>
          </div>

          <aside className="rounded-lg border border-line bg-surface p-5 sm:p-6">
            <p className="text-meta font-semibold uppercase tracking-[0.1em] text-brand">Live preview</p>
            <h2 className="mt-2 text-base font-semibold text-ink">Caption appearance</h2>
            <p className="mt-1 text-sm text-muted">Updates as you change caption preferences.</p>
            <div className={`mt-5 rounded-md border border-line bg-canvas px-4 ${previewSpacing}`}>
              <p className={`leading-relaxed tracking-tight text-ink ${previewTextSize}`}>“Welcome to our session. We’re glad you’re here.”</p>
              <p className="mt-4 text-xs text-muted">{settings.language} <span className="px-1.5" aria-hidden="true">·</span> 00:08</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-subtle">Display preferences follow your account. The microphone selection stays on this device.</p>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
