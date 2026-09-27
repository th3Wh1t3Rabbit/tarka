import type { SpeechLine } from '../adventure/types'
import { publicSpeaker } from '../controller/content/adapter'
import { useFullDeliveryClamp } from './useFullDeliveryClamp'

export type DialoguePresentationMode = 'FULLSCREEN_CRT' | 'DOCKED_OVERLAY' | 'PLAIN_LIST'

export interface GameDialoguePresentationProps {
  line: SpeechLine
  visibleCharacters: number
  mode?: DialoguePresentationMode
  reducedMotion?: boolean
  crossedCueIds?: readonly string[]
  performance?: string
  afterLineHold?: boolean
  lineIndex?: number
  onAdvance?: () => void
  testId?: string
  style?: React.CSSProperties
}

function visibleDelivery(line: SpeechLine, visibleCharacters: number) {
  const end = Math.min(line.text.length, visibleCharacters)
  const ranges = [...(line.emphasis ?? [])].sort((a, b) => a.start - b.start)
  const nodes: React.ReactNode[] = []
  let cursor = 0
  ranges.forEach((range, index) => {
    if (range.start >= end) return
    if (range.start > cursor) nodes.push(<span key={`plain-${index}`}>{line.text.slice(cursor, Math.min(range.start, end))}</span>)
    if (range.end > cursor) nodes.push(<em key={`em-${index}`}>{line.text.slice(Math.max(cursor, range.start), Math.min(range.end, end))}</em>)
    cursor = Math.max(cursor, range.end)
  })
  if (cursor < end) nodes.push(<span key="plain-end">{line.text.slice(cursor, end)}</span>)
  return nodes
}

export function GameDialoguePresentation({ line, visibleCharacters, mode = 'FULLSCREEN_CRT', reducedMotion = false, crossedCueIds = [], performance = '', afterLineHold = false, lineIndex = 0, onAdvance, testId = 'speech-panel', style }: GameDialoguePresentationProps) {
  const { nodeRef, measureRef, clampStyle, fullDeliveryWidth, deliveryKey } = useFullDeliveryClamp(line.text, style?.left)
  const revealing = visibleCharacters < line.text.length
  const content = <>
    <span ref={measureRef} className="full-delivery-measure" aria-hidden="true">{line.text}</span>
    <strong aria-hidden="true">{publicSpeaker(line.speaker)}</strong>
    <span aria-hidden="true">{visibleDelivery(line, visibleCharacters)}{revealing && <i />}</span>
    <small aria-hidden="true">{revealing ? 'CLICK OR SPACE TO REVEAL' : afterLineHold ? 'REACTION HOLDS · CLICK OR SPACE TO CONTINUE' : 'CLICK OR SPACE TO CONTINUE'}</small>
  </>
  const common = {
    className: `speech-panel game-dialogue-presentation mode-${mode.toLowerCase().replaceAll('_', '-')} ${reducedMotion ? 'reduced-motion' : ''}`,
    'data-testid': testId,
    'data-renderer-line': line.copyKey,
    'data-speaker': line.speaker,
    'data-copy-key': line.sourceCopyKey ?? line.copyKey,
    'data-delivery-key': line.copyKey,
    'data-revealing': revealing,
    'data-line-index': lineIndex,
    'data-crossed-cues': crossedCueIds.join(','),
    'data-performance': performance,
    'data-after-line-hold': afterLineHold,
    'data-presentation-mode': mode,
    'data-reduced-motion': reducedMotion,
    'data-full-delivery-width': fullDeliveryWidth,
    'data-full-delivery-key': deliveryKey,
    'aria-label': `${publicSpeaker(line.speaker)}: ${line.sourceText ?? line.text}`,
    style: { ...style, ...clampStyle },
  } as const
  if (onAdvance) return <button {...common} ref={nodeRef} onClick={onAdvance} onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') event.preventDefault() }}>{content}</button>
  return <article {...common} ref={nodeRef}>{content}</article>
}
