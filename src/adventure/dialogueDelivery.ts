import type { SpeechEmphasis, SpeechLine } from './types'

function parseEmphasis(text: string): { text: string; emphasis: SpeechEmphasis[] } {
  const emphasis: SpeechEmphasis[] = []
  let clean = ''
  let open: number | null = null
  for (const character of text) {
    if (character === '*') {
      if (open == null) open = clean.length
      else { emphasis.push({ start: open, end: clean.length }); open = null }
    } else clean += character
  }
  if (open != null) clean = `${clean.slice(0, open)}*${clean.slice(open)}`
  return { text: clean, emphasis }
}

function trademarkCharacterDialogue(text: string, speaker: SpeechLine['speaker']) {
  return speaker === 'SYSTEM' || speaker === 'TERMINAL' ? text : text.replace(/\bNansen(?!™)/g, 'Nansen™')
}

export const PROVISIONAL_DELIVERY_CHARACTER_LIMIT = 84

/**
 * Compiler-owned provisional segmentation. Authored deliveryParts always win;
 * otherwise a long source delivery is split only at word boundaries. Runtime
 * CSS never decides where a bubble breaks.
 */
export function provisionalDeliveryParts(text: string, limit = PROVISIONAL_DELIVERY_CHARACTER_LIMIT): Array<{ text: string; start: number }> {
  if (text.length <= limit) return [{ text, start: 0 }]
  const parts: Array<{ text: string; start: number }> = []
  let start = 0
  while (start < text.length) {
    const remaining = text.slice(start)
    if (remaining.length <= limit) { parts.push({ text: remaining.trim(), start }); break }
    const window = remaining.slice(0, limit + 1)
    const boundary = Math.max(window.lastIndexOf(' '), window.lastIndexOf('—'), window.lastIndexOf('…'))
    const following = remaining.slice(limit + 1).search(/[ —…]/)
    const take = boundary > 0 ? boundary + (window[boundary] === ' ' ? 0 : 1) : following >= 0 ? limit + 1 + following : remaining.length
    const raw = remaining.slice(0, take)
    const leading = raw.length - raw.trimStart().length
    parts.push({ text: raw.trim(), start: start + leading })
    start += take
    while (text[start] === ' ') start += 1
  }
  return parts.filter((part) => part.text.length > 0)
}

/** The single production boundary for player-visible character dialogue. */
export function normalizeProductionDialogue(lines: readonly SpeechLine[]): SpeechLine[] {
  return lines.flatMap((source) => {
    const explicit = Boolean(source.deliveryParts?.length)
    const authoredParts = explicit ? [...source.deliveryParts!] : [source.text]
    const sourceFolded = source.text.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim()
    const sourceText = trademarkCharacterDialogue(source.literalMarkup ? sourceFolded : parseEmphasis(sourceFolded).text, source.speaker)
    const rawParts = authoredParts.flatMap((authored) => {
      const folded = authored.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim()
      return explicit ? [{ text: folded, start: 0 }] : provisionalDeliveryParts(folded)
    })
    return rawParts.map(({ text: raw, start }, index) => {
      const folded = raw.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim()
      const parsed = source.literalMarkup ? { text: folded, emphasis: [] } : parseEmphasis(folded)
      const text = trademarkCharacterDialogue(parsed.text, source.speaker)
      const next: SpeechLine = { ...source, text }
      delete next.deliveryParts
      if (rawParts.length > 1) {
        next.sourceText = source.sourceText ?? sourceText
        const sourceCopyKey = source.sourceCopyKey ?? source.copyKey
        if (sourceCopyKey) next.sourceCopyKey = sourceCopyKey
      }
      const inherited = (source.emphasis ?? []).flatMap((range) => {
        const localStart = Math.max(range.start, start) - start
        const localEnd = Math.min(range.end, start + text.length) - start
        return localEnd > localStart ? [{ start: localStart, end: localEnd }] : []
      })
      const emphasis = [...inherited, ...parsed.emphasis]
      if (emphasis.length) next.emphasis = emphasis
      else delete next.emphasis
      if (rawParts.length > 1 && source.copyKey) next.copyKey = `${source.copyKey}.${explicit ? 'delivery' : 'provisional'}-${index + 1}`
      return next
    })
  })
}
