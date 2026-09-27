import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const baseURL = process.env.S16_R3_BASE_URL ?? 'http://127.0.0.1:4175/'
const output = resolve(process.env.S16_R3_AUDIO_OUT ?? 'review/s16-r3/audio')
const terminalPath = resolve('public/audio/background-terminal.ogg')
const effectPath = resolve('public/audio/degauss-sfx.mp3')
const sha256 = async path => createHash('sha256').update(await readFile(path)).digest('hex')
const before = { terminal: await sha256(terminalPath), effect: await sha256(effectPath) }

await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
await page.exposeFunction('s16R3Progress', value => process.stdout.write(`${JSON.stringify(value)}\n`))
await page.goto(baseURL)

const result = await page.evaluate(async () => {
  const peakOffsetSeconds = 0.745
  const effectGainValue = 0.75
  const musicGainValue = 0.22
  const audio = new Audio('/audio/background-terminal.ogg')
  audio.loop = true
  audio.preload = 'auto'
  document.body.append(audio)
  await new Promise((resolve, reject) => {
    audio.addEventListener('loadedmetadata', resolve, { once: true })
    audio.addEventListener('error', () => reject(new Error('terminal media metadata failed')), { once: true })
    audio.load()
  })
  const context = new AudioContext()
  const effectBytes = await fetch('/audio/degauss-sfx.mp3', { credentials: 'same-origin' }).then(response => {
    if (!response.ok) throw new Error('effect fetch failed')
    return response.arrayBuffer()
  })
  const effectBuffer = await context.decodeAudioData(effectBytes.slice(0))
  const terminalDuration = audio.duration
  const source = context.createMediaElementSource(audio)
  const musicGain = context.createGain()
  const mix = context.createGain()
  const captureDestination = context.createMediaStreamDestination()
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  musicGain.gain.value = musicGainValue
  source.connect(musicGain).connect(mix)
  mix.connect(context.destination)
  mix.connect(captureDestination)
  mix.connect(analyser)
  await context.resume()

  const captures = []
  const schedules = []
  let activeRecorder = null
  let activeVoiceCount = 0
  let maximumVoiceCount = 0
  let maximumOutputSample = 0
  let cycle = 0
  let scheduledCycle = -1
  let lastPosition = 0
  let lastProgress = -1
  let finished = false
  const sampleWindow = new Float32Array(analyser.fftSize)

  const encodeBase64 = bytes => {
    let binary = ''
    const chunk = 0x8000
    for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
    return btoa(binary)
  }
  const startCapture = targetCycle => {
    if (activeRecorder) return
    const chunks = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
    const recorder = new MediaRecorder(captureDestination.stream, mimeType ? { mimeType } : undefined)
    const capture = { targetCycle, recorder, chunks, startedAt: context.currentTime, boundaryAt: null, stopAfter: null }
    activeRecorder = capture
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.start(100)
  }
  const stopCapture = capture => new Promise(resolve => {
    capture.recorder.onstop = async () => {
      const blob = new Blob(capture.chunks, { type: capture.recorder.mimeType })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      captures.push({
        cycle: capture.targetCycle,
        mimeType: blob.type,
        bytes: bytes.length,
        startedAt: capture.startedAt,
        boundaryAt: capture.boundaryAt,
        stoppedAt: context.currentTime,
        base64: encodeBase64(bytes),
      })
      if (activeRecorder === capture) activeRecorder = null
      resolve()
    }
    capture.recorder.stop()
  })

  const completion = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('two-wrap media capture timed out')), (terminalDuration * 2 + 20) * 1000)
    const timer = setInterval(async () => {
      if (finished) return
      const position = audio.currentTime
      const now = context.currentTime
      analyser.getFloatTimeDomainData(sampleWindow)
      for (const value of sampleWindow) maximumOutputSample = Math.max(maximumOutputSample, Math.abs(value))
      if (position + 0.25 < lastPosition) {
        cycle += 1
        const observedBoundary = now - position
        const schedule = schedules.find(item => item.cycle === cycle)
        if (schedule) {
          schedule.observedBoundary = observedBoundary
          schedule.observedDriftMs = (observedBoundary - schedule.predictedBoundary) * 1000
        }
        if (activeRecorder?.targetCycle === cycle) {
          activeRecorder.boundaryAt = observedBoundary
          activeRecorder.stopAfter = observedBoundary + 2.8
        }
      }
      lastPosition = position
      const remaining = terminalDuration - position
      const targetCycle = cycle + 1
      if (!activeRecorder && captures.length < 2 && remaining <= 1.3 && remaining > 0.05) startCapture(targetCycle)
      const onsetDelay = remaining - peakOffsetSeconds
      if (scheduledCycle !== targetCycle && onsetDelay >= 0.12 && onsetDelay <= 0.42) {
        const predictedBoundary = now + remaining
        const startAt = predictedBoundary - peakOffsetSeconds
        const voice = context.createBufferSource()
        const gain = context.createGain()
        voice.buffer = effectBuffer
        gain.gain.value = effectGainValue
        voice.connect(gain).connect(mix)
        activeVoiceCount += 1
        maximumVoiceCount = Math.max(maximumVoiceCount, activeVoiceCount)
        voice.onended = () => { activeVoiceCount -= 1 }
        voice.start(startAt)
        schedules.push({ cycle: targetCycle, predictedBoundary, effectStartAt: startAt, effectPeakAt: startAt + peakOffsetSeconds, effectEndAt: startAt + effectBuffer.duration })
        scheduledCycle = targetCycle
      }
      if (activeRecorder?.stopAfter && now >= activeRecorder.stopAfter && activeRecorder.recorder.state === 'recording') await stopCapture(activeRecorder)
      const elapsedWhole = Math.floor(now)
      if (elapsedWhole !== lastProgress && elapsedWhole % 15 === 0) {
        lastProgress = elapsedWhole
        await window.s16R3Progress({ kind: 'actual-media-progress', contextTime: now, mediaTime: position, cycle, captures: captures.length })
      }
      if (cycle >= 2 && captures.length >= 2 && !activeRecorder) {
        finished = true
        clearInterval(timer)
        clearTimeout(timeout)
        audio.pause()
        resolve()
      }
    }, 25)
  })
  await audio.play()
  await completion
  const report = {
    evidenceClass: 'ACTUAL_BROWSER_MEDIAELEMENT_WEBAUDIO_OUTPUT_CAPTURE',
    browser: navigator.userAgent,
    sameOrigin: new URL(audio.currentSrc).origin === location.origin,
    mediaURL: new URL(audio.currentSrc).pathname,
    terminalDecodedDurationSeconds: terminalDuration,
    effectDecodedDurationSeconds: effectBuffer.duration,
    audioContextSampleRate: context.sampleRate,
    peakOffsetSeconds,
    gains: { terminal: musicGainValue, effect: effectGainValue },
    wrapsObserved: cycle,
    schedules,
    captures,
    maximumSimultaneousEffectVoices: maximumVoiceCount,
    maximumObservedOutputSample: maximumOutputSample,
    automaticVisualActivations: document.querySelectorAll('.is-degaussing').length,
    subjectiveListening: 'NOT_PERFORMED',
    deviceLatencyAssessment: 'NOT_CLAIMED_HEADLESS_BROWSER_CAPTURE',
  }
  await context.close()
  audio.remove()
  return report
})

for (const capture of result.captures) {
  const name = `terminal-wrap-${capture.cycle}-bounded.webm`
  await writeFile(resolve(output, name), Buffer.from(capture.base64, 'base64'))
  capture.file = name
  delete capture.base64
}
const after = { terminal: await sha256(terminalPath), effect: await sha256(effectPath) }
if (before.terminal !== after.terminal || before.effect !== after.effect) throw new Error('Original audio bytes changed during evidence capture')
const report = {
  ...result,
  method: 'Two uninterrupted normal-speed full-length HTMLMediaElement loop wraps, routed through the browser Web Audio graph and captured from its MediaStream destination in bounded seam windows.',
  sourceHashesSha256: before,
  sourceHashesUnchangedAfterCapture: before.terminal === after.terminal && before.effect === after.effect,
  limitations: ['Headless-browser output capture; no human subjective listening performed.', 'Device-specific acoustic output latency is outside this capture class.'],
}
await writeFile(resolve(output, 'actual-loop-media.json'), `${JSON.stringify(report, null, 2)}\n`)
await browser.close()
process.stdout.write(`${JSON.stringify({ status: 'ACTUAL_LOOP_MEDIA_CAPTURE_COMPLETE', output, wraps: report.wrapsObserved, captures: report.captures.map(item => item.file) })}\n`)
