export type FitPolicy = 'NEAREST_EXACT' | 'NEAREST_CONTAIN'
export type PixelScaling = 'NEAREST_NEIGHBOR'

export interface PixelBox { width: number; height: number }

export interface RenderContract {
  sourceDimensions: PixelBox
  renderBox: PixelBox
  fitPolicy: FitPolicy
  pixelScaling: PixelScaling
}

export const INVENTORY_RENDER_BOX: PixelBox = { width: 24, height: 24 }
export const CURSOR_SOURCE_BOX: PixelBox = { width: 13, height: 13 }
export const CURSOR_HOTSPOT = { x: 6, y: 6 }
export const PROP_RENDER_BOX: PixelBox = { width: 64, height: 96 }
export const PLATE_BOX: PixelBox = { width: 480, height: 180 }

export function containFits(source: PixelBox, box: PixelBox) {
  if (!Number.isInteger(box.width) || !Number.isInteger(box.height) || box.width < 1 || box.height < 1) return false
  if (source.width < 1 || source.height < 1) return false
  const scale = Math.min(box.width / source.width, box.height / source.height)
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)
  return width >= 1 && height >= 1 && width <= box.width && height <= box.height
}

/** Sprite boxes already fitted to the cabinet art. Click polygons are tighter and must not move these. */
export const OFFICIAL_CABINET_ART = { x: 610, y: 158, width: 112, height: 134 }
export const MISC_CABINET_ART = { x: 730, y: 164, width: 108, height: 130 }

export function fittedHotspotBox(polygon: string, source: PixelBox, ceilingY = 156) {
  const points = polygon.split(' ').map((pair) => pair.split(',').map(Number))
  const xs = points.map(([x]) => x ?? 0)
  const ys = points.map(([, y]) => y ?? 0)
  const left = Math.min(...xs)
  const bottom = Math.max(...ys)
  let width = Math.max(...xs) - left
  let height = Math.round(width * source.height / source.width)
  let top = bottom - height
  if (top < ceilingY) {
    height = Math.max(1, bottom - ceilingY)
    width = Math.max(1, Math.round(height * source.width / source.height))
    top = bottom - height
  }
  return { x: left, y: top, width, height }
}

/** Snap a 960×360 game coordinate onto the scene's pixel grid. */
export function snapGameToScenePixel(game: number, scale: number) {
  const safe = scale >= 1 ? scale : 1
  return Math.round(game * safe / 2) * 2 / safe
}

export function gameBoxStyle(box: { x: number; y: number; width: number; height: number }) {
  return { left: `${box.x / 9.6}%`, top: `${box.y / 3.6}%`, width: `${box.width / 9.6}%`, height: `${box.height / 3.6}%` }
}

export function aspectHeight(renderWidth: number, source: PixelBox) {
  if (!Number.isInteger(renderWidth) || renderWidth < 1 || source.width < 1 || source.height < 1) return null
  const height = Math.round(renderWidth * source.height / source.width)
  return height >= 1 ? height : null
}

export function slotRenderContract(input: {
  packId: string
  kind: 'background' | 'layer' | 'character' | 'prop' | 'inventory' | 'cursor'
  asset: PixelBox | null
  family?: PixelBox
  placeholder: PixelBox
}): RenderContract | null {
  const pixelScaling: PixelScaling = 'NEAREST_NEIGHBOR'
  if (input.packId !== 'production') {
    return { sourceDimensions: input.placeholder, renderBox: input.placeholder, fitPolicy: 'NEAREST_EXACT', pixelScaling }
  }
  if (input.kind === 'character') {
    if (!input.family) return null
    return { sourceDimensions: input.family, renderBox: input.family, fitPolicy: 'NEAREST_EXACT', pixelScaling }
  }
  if (input.kind === 'cursor') return { sourceDimensions: CURSOR_SOURCE_BOX, renderBox: CURSOR_SOURCE_BOX, fitPolicy: 'NEAREST_EXACT', pixelScaling }
  if (input.kind === 'inventory') return { sourceDimensions: input.asset ?? INVENTORY_RENDER_BOX, renderBox: INVENTORY_RENDER_BOX, fitPolicy: 'NEAREST_CONTAIN', pixelScaling }
  if (input.kind === 'prop') return { sourceDimensions: input.asset ?? PROP_RENDER_BOX, renderBox: PROP_RENDER_BOX, fitPolicy: 'NEAREST_CONTAIN', pixelScaling }
  return { sourceDimensions: PLATE_BOX, renderBox: PLATE_BOX, fitPolicy: 'NEAREST_EXACT', pixelScaling }
}

export function renderContractFailure(contract: RenderContract | null, declared: PixelBox | null, decoded: PixelBox | null): string | null {
  if (!contract) return 'Render contract is missing.'
  if (!declared || !decoded) return null
  if (declared.width !== decoded.width || declared.height !== decoded.height) return `Decoded ${decoded.width}x${decoded.height}; manifest declares ${declared.width}x${declared.height}.`
  if (contract.fitPolicy === 'NEAREST_EXACT' && (declared.width !== contract.renderBox.width || declared.height !== contract.renderBox.height)) {
    return `Declared ${declared.width}x${declared.height}; exact render contract requires ${contract.renderBox.width}x${contract.renderBox.height}.`
  }
  if (contract.fitPolicy === 'NEAREST_CONTAIN' && !containFits(declared, contract.renderBox)) {
    return `Declared ${declared.width}x${declared.height} does not contain in ${contract.renderBox.width}x${contract.renderBox.height}.`
  }
  if (contract.pixelScaling !== 'NEAREST_NEIGHBOR') return 'Pixel scaling must be nearest-neighbor.'
  return null
}
