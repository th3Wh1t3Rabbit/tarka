export interface PlacedImageInput {
  src: string
  width: number
  height: number
  blur: number
}

export interface PlacedPaint {
  identity: string
  url: string
}

export function placedImageIdentity(input: PlacedImageInput): string {
  return `${input.src}\n${input.width}\n${input.height}\n${input.blur}`
}

/** Keep a completed paint only when it belongs to the identity now on screen. */
export function commitPlacedPaint(currentIdentity: string, previous: PlacedPaint | null, result: PlacedPaint): PlacedPaint | null {
  if (result.identity !== currentIdentity) return previous?.identity === currentIdentity ? previous : null
  return result
}

export function visiblePlacedImage(input: PlacedImageInput, paint: PlacedPaint | null, failedIdentity: string | null): string {
  if (input.blur <= 0 || input.width < 1 || input.height < 1) return input.src
  const identity = placedImageIdentity(input)
  if (failedIdentity === identity) return input.src
  if (paint?.identity === identity) return paint.url
  return input.src
}
