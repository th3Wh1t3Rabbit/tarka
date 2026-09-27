import { useRef, useState } from 'react'

/** One shared SOURCE implementation in every terminal presentation. */
export function ExactIdentifier({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  const [feedback, setFeedback] = useState('')
  const sequence = useRef(0)
  async function copy() {
    const request = ++sequence.current
    setFeedback(`Copying ${label.toLowerCase()}…`)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      if (request === sequence.current) setFeedback(`Copied ${label.toLowerCase()} exactly.`)
    } catch {
      if (request === sequence.current) setFeedback(`Could not copy ${label.toLowerCase()}. The full value remains visible and selectable. Check clipboard permission, retry COPY, or focus the read-only value and use Select All / Copy.`)
    }
  }
  if (compact) return <span className="exact-identifier-row"><b>{label}</b><span className="exact-identifier" style={{ overflowWrap: 'anywhere', userSelect: 'text' }}>{value}</span><button type="button" aria-label={`Copy ${label}`} onClick={() => { void copy() }}>COPY</button><span role="status" aria-live="polite" aria-atomic="true">{feedback}</span></span>
  return <><span className="exact-identifier" style={{ overflowWrap: 'anywhere', userSelect: 'text' }}>{value}</span><button type="button" aria-label={`Copy ${label}`} onClick={() => { void copy() }}>COPY</button><details><summary>Selectable exact {label.toLowerCase()}</summary><label>{label}<input aria-label={`Selectable exact ${label.toLowerCase()}`} readOnly value={value} onFocus={(event) => event.currentTarget.select()} /></label></details><span role="status" aria-live="polite" aria-atomic="true">{feedback}</span></>
}
