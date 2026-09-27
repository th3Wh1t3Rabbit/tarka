import { useEffect, useRef, useState } from 'react'
import { inventoryItems } from '../adventure/content'
import { artStackOrder, CROP_BLUR_MAX, CROP_BLUR_STEP, importComposition, paintOrderFromFront, readLayoutDraft, readLayoutLibrary, readOnlyHotspots, referenceComposition, removeLayoutVersion, renderHeight, saveLayoutVersion, sealComposition, setDefaultLayoutVersion, snapCropBlur, withCatalogEntities, writeLayoutDraft, type CompositionEntity, type LayoutLibrary, type SavedLayoutVersion, type SceneComposition } from '../adventure/sceneComposition'
import type { InventoryItemId } from '../adventure/types'
import './art-layout.css'
import { FORM_ART } from '../adventure/formArt'

const PLATE = '/art-packs/production/room-plate-480x180.png'
const VERB_FACE = ['Give', 'Pick up', 'Use', 'Open', 'Look at', 'Push', 'Close', 'Talk to', 'Pull']

type DrawnHotspot = { id: string; name: string; x: number; y: number; width: number; height: number }
const APPROVED_INVENTORY: { id: InventoryItemId; src: string }[] = [
  { id: 'blank-terminal-authorization-form', src: FORM_ART.BLANK.src },
  { id: 'loose-feather-pen', src: '/art-packs/production/files/included/core-v2.1/inventory/pen_whole.png' },
  { id: 'signed-terminal-authorization-form-with-doodles', src: FORM_ART.SIGNED_DOODLED.src },
  { id: 'broken-feather-pen', src: '/art-packs/production/files/included/core-v2.1/inventory/pen_broken.png' },
  { id: 'approved-stamped-terminal-authorization-form', src: FORM_ART.APPROVED_OK.src },
  { id: 'euler-case-file', src: '/art-packs/production/files/included/core-v2.1/inventory/euler_file.png' },
  { id: 'rubber-band', src: '/art-packs/production/files/included/core-v2.1/inventory/rubber_band.png' },
  { id: 'rubiks-cube', src: '/art-packs/production/files/included/core-v2.1/inventory/rubiks_cube.png' },
  { id: 'sharknado-2-vhs', src: '/art-packs/production/files/included/core-v2.1/inventory/vhs_shark.png' },
  { id: 'piggy-bank-intact', src: '/art-packs/production/files/included/core-v2.1/inventory/piggy_intact.png' },
  { id: 'small-toolbox-closed', src: '/art-packs/production/files/included/core-v2.1/inventory/toolbox_closed.png' },
  { id: 'small-toolbox-open-empty', src: '/art-packs/production/files/included/core-v2.1/inventory/toolbox_open_empty.png' },
  { id: 'hammer', src: '/art-packs/production/files/included/core-v2.1/inventory/hammer_pink.png' },
  { id: 'nails', src: '/art-packs/production/files/included/core-v2.1/inventory/nails.png' },
  { id: 'fictional-token-note', src: '/art-packs/production/files/included/core-v2.1/inventory/piggy_fragments_note.png' },
]

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function LayerStack({ items, onReorder }: { items: CompositionEntity[]; onReorder: (frontToBack: string[]) => void }) {
  const frontFirst = [...artStackOrder(items.filter((item) => item.visible))].reverse()
  const byId = new Map(frontFirst.map((item) => [item.id, item]))
  const baseIds = frontFirst.map((item) => item.id)
  const [preview, setPreview] = useState<string[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const drag = useRef<{ id: string; pointerId: number } | null>(null)
  const order = useRef<string[]>(baseIds)
  const listRef = useRef<HTMLOListElement>(null)
  const shown = (preview ?? baseIds).map((id) => byId.get(id)).filter((item): item is CompositionEntity => Boolean(item))
  function placeAt(clientY: number) {
    const active = drag.current
    const list = listRef.current
    if (!active || !list) return
    const ids = [...order.current]
    const box = list.getBoundingClientRect()
    const rowHeight = box.height / ids.length
    const targetIndex = Math.min(ids.length - 1, Math.max(0, Math.floor((clientY - box.top) / rowHeight)))
    const from = ids.indexOf(active.id)
    if (from < 0 || from === targetIndex) return
    ids.splice(from, 1)
    ids.splice(targetIndex, 0, active.id)
    order.current = ids
    setPreview([...ids])
  }
  return <ol className="layer-stack" ref={listRef} aria-label="Layers, front at the top">{shown.map((item) => <li key={item.id} data-layer-id={item.id} className={draggingId === item.id ? 'dragging' : ''} onPointerDown={(event) => { drag.current = { id: item.id, pointerId: event.pointerId }; setDraggingId(item.id); order.current = preview ?? baseIds; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={(event) => { if (drag.current?.pointerId === event.pointerId) placeAt(event.clientY) }} onPointerUp={(event) => { if (drag.current?.pointerId !== event.pointerId) return; const next = order.current; drag.current = null; setDraggingId(null); setPreview(null); if (next.join('|') !== baseIds.join('|')) onReorder(next) }}>{item.label}{item.id === 'rook' ? ' · front' : ''}{item.id === 'desk' ? ' · in front of Arthur' : ''}</li>)}</ol>
}

export function ArtLayoutWorkbench() {
  const [composition, setComposition] = useState<SceneComposition>(() => withCatalogEntities(readLayoutDraft() ?? referenceComposition()))
  const [selectedId, setSelectedId] = useState('rook')
  const [scale, setScale] = useState<1 | 2 | 4>(2)
  const [drawHotspot, setDrawHotspot] = useState(false)
  const [drawnHotspots, setDrawnHotspots] = useState<DrawnHotspot[]>([])
  const [draft, setDraft] = useState<DrawnHotspot | null>(null)
  const [blackout, setBlackout] = useState(false)
  const [slots, setSlots] = useState<(InventoryItemId | null)[]>(() => Array.from({ length: 10 }, () => null))
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [library, setLibrary] = useState<LayoutLibrary>(() => readLayoutLibrary())
  const [versionName, setVersionName] = useState('Layout')
  const [makeDefaultOnSave, setMakeDefaultOnSave] = useState(false)
  const [message, setMessage] = useState('Drag a sprite to move it. Arrow keys nudge the selection by 1 pixel. Positions are not Principal-approved yet.')
  const roomRef = useRef<HTMLDivElement>(null)
  const selected = composition.entities.find((item) => item.id === selectedId) ?? composition.entities[0]!
  const gameDefault = library.versions.find((version) => version.id === library.defaultVersionId) ?? null
  useEffect(() => { writeLayoutDraft(localStorage, composition) }, [composition])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return
      const step = event.shiftKey ? 8 : 1
      if (event.key === 'ArrowLeft') update(selected.id, { x: selected.x - step })
      else if (event.key === 'ArrowRight') update(selected.id, { x: selected.x + step })
      else if (event.key === 'ArrowUp') update(selected.id, { y: selected.y - step })
      else if (event.key === 'ArrowDown') update(selected.id, { y: selected.y + step })
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function update(id: string, patch: Partial<CompositionEntity>) {
    const rounded = { ...patch }
    if (rounded.x !== undefined) rounded.x = Math.round(rounded.x)
    if (rounded.y !== undefined) rounded.y = Math.round(rounded.y)
    if (rounded.z !== undefined) rounded.z = Math.round(rounded.z)
    if (rounded.renderWidth !== undefined) rounded.renderWidth = Math.max(1, Math.round(rounded.renderWidth))
    if (rounded.blur !== undefined) rounded.blur = snapCropBlur(rounded.blur)
    setComposition((current) => ({
      ...current,
      principalDisposition: 'PENDING_PRINCIPAL_PLACEMENT',
      contentSha256: '',
      entities: current.entities.map((item) => item.id === id ? { ...item, ...rounded, src: rounded.state ? item.states[rounded.state] ?? item.src : item.src } : item),
    }))
  }

  function saveCurrentVersion() {
    const saved = saveLayoutVersion(localStorage, versionName, composition, makeDefaultOnSave)
    if (saved.error) { setMessage(saved.error); return }
    setLibrary(saved.library)
    const chosen = makeDefaultOnSave ? saved.library.versions.at(-1) : null
    setMessage(chosen ? `Saved ${chosen.name} and set it as the game default. Open the live scene to check the placement and blur.` : `Saved ${versionName.trim() || 'the version'}. Choose GAME DEFAULT on the one the live scene should use.`)
  }

  function loadVersion(version: SavedLayoutVersion) {
    const imported = importComposition(version.composition)
    if (imported.error || !imported.composition) { setMessage(imported.error ?? 'Could not load that version'); return }
    setComposition(withCatalogEntities(imported.composition))
    setVersionName(version.name)
    setMessage(`Loaded ${version.name}. Blur and placement from that save are on the picture.`)
  }

  function chooseGameDefault(version: SavedLayoutVersion) {
    const next = setDefaultLayoutVersion(localStorage, version.id)
    setLibrary(next)
    setMessage(`${version.name} is now the game default. Open the live scene to see this placement and these blur levels.`)
  }

  async function exportLayout() {
    const sealed = await sealComposition({ ...composition, principalDisposition: 'PRINCIPAL_EXPORTED', hotspots: readOnlyHotspots() }, sha256)
    if (sealed.error || !sealed.composition) { setMessage(sealed.error ?? 'Export failed'); return }
    setComposition(sealed.composition)
    const text = JSON.stringify(sealed.composition, null, 2)
    download('SCENE_COMPOSITION_PRINCIPAL.json', text)
    setMessage(`Exported SCENE_COMPOSITION_PRINCIPAL.json. SHA-256 ${sealed.composition.contentSha256}. Keep the downloaded filename and attach it to the review task.`)
  }

  async function onImport(file: File) {
    const parsed: unknown = JSON.parse(await file.text())
    const result = importComposition(parsed)
    if (result.error || !result.composition) { setMessage(result.error ?? 'Import failed'); return }
    const sealed = await sealComposition(result.composition, sha256)
    if (sealed.error || !sealed.composition) { setMessage(sealed.error ?? 'Import failed'); return }
    const supplied = (parsed as SceneComposition).contentSha256
    if (supplied && supplied !== sealed.composition.contentSha256) { setMessage('Import rejected. Content SHA does not match the canonical body.'); return }
    setComposition(sealed.composition)
    setMessage(`Imported ${file.name}. Canonical SHA-256 ${sealed.composition.contentSha256}.`)
  }

  function onPointerDown(event: React.PointerEvent<HTMLImageElement>, item: CompositionEntity) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedId(item.id)
    const originX = event.clientX
    const originY = event.clientY
    const startX = item.x
    const startY = item.y
    const move = (next: PointerEvent) => {
      update(item.id, { x: startX + Math.round((next.clientX - originX) / scale), y: startY + Math.round((next.clientY - originY) / scale) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  async function capture() {
    const canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 180
    const context = canvas.getContext('2d')
    if (!context || !roomRef.current) return
    context.imageSmoothingEnabled = false
    const plate = roomRef.current.querySelector<HTMLImageElement>('.plate')
    if (plate) context.drawImage(plate, 0, 0, 480, 180)
    for (const item of artStackOrder(composition.entities.filter((entry) => entry.visible))) {
      const image = roomRef.current.querySelector<HTMLImageElement>(`img[data-entity="${item.id}"]`)
      if (!image) continue
      const blur = item.id.startsWith('bg-') ? item.blur : 0
      context.save()
      context.filter = blur > 0 ? `blur(${blur}px)` : 'none'
      if (item.mirror) { context.translate(item.x + item.renderWidth, item.y); context.scale(-1, 1); context.drawImage(image, 0, 0, item.renderWidth, renderHeight(item)) }
      else context.drawImage(image, item.x, item.y, item.renderWidth, renderHeight(item))
      context.restore()
    }
    const link = document.createElement('a')
    link.download = 'art-layout-review.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return <main className="art-layout" data-testid="art-layout-workbench">
    <header>
      <div><h1>ART LAYOUT WORKBENCH</h1><p>Drag a sprite. Arrow keys nudge it. Turn on Draw Hotspot to mark anything that still needs one. <a href="/?animDirector=1">Animation director</a></p></div>
      <div>
        <button type="button" aria-pressed={scale === 1} onClick={() => setScale(1)}>NATIVE</button>
        <button type="button" aria-pressed={scale === 2} onClick={() => setScale(2)}>2×</button>
        <button type="button" aria-pressed={scale === 4} onClick={() => setScale(4)}>4×</button>
      </div>
    </header>
    <aside className="entity-list">
      {composition.entities.map((item) => <div className="entity-row" key={item.id}><button type="button" aria-pressed={item.id === selected.id} onClick={() => setSelectedId(item.id)}>{item.visible ? '●' : '○'} {item.label}</button>{item.visible && item.id !== 'rook' ? <button type="button" aria-label={`Remove ${item.label} from the picture`} onClick={() => update(item.id, { visible: false })}>Remove</button> : !item.visible ? <button type="button" aria-label={`Show ${item.label} on the picture`} onClick={() => update(item.id, { visible: true })}>Show</button> : null}</div>)}
    </aside>
    <div className="stage">
      <div className="room" ref={roomRef} data-testid="art-layout-room" style={{ width: 480 * scale, height: 270 * scale }}>
        <img className="plate" alt="" src={PLATE} style={{ top: 0, left: 0, right: 'auto', bottom: 'auto', width: 480 * scale, height: 180 * scale }} />
        {[...drawnHotspots, ...(draft ? [draft] : [])].map((hotspot) => {
          const left = Math.min(hotspot.x, hotspot.x + hotspot.width)
          const top = Math.min(hotspot.y, hotspot.y + hotspot.height)
          return <div key={hotspot.id} className="drawn-hotspot" style={{ left: left * scale, top: top * scale, width: Math.abs(hotspot.width) * scale, height: Math.abs(hotspot.height) * scale }}><span>{hotspot.name}</span></div>
        })}
        {drawHotspot && <div className="draw-layer" data-testid="art-layout-draw" onPointerDown={(event) => {
          if (!roomRef.current) return
          const rect = roomRef.current.getBoundingClientRect()
          const x = Math.round((event.clientX - rect.left) / scale)
          const y = Math.round((event.clientY - rect.top) / scale)
          const next = { id: 'draft', name: 'New hotspot', x, y, width: 0, height: 0 }
          setDraft(next)
          event.currentTarget.setPointerCapture(event.pointerId)
          const move = (pointer: PointerEvent) => {
            const width = Math.round((pointer.clientX - rect.left) / scale) - x
            const height = Math.round((pointer.clientY - rect.top) / scale) - y
            setDraft({ ...next, width, height })
          }
          const up = (pointer: PointerEvent) => {
            const width = Math.round((pointer.clientX - rect.left) / scale) - x
            const height = Math.round((pointer.clientY - rect.top) / scale) - y
            const left = Math.min(x, x + width)
            const top = Math.min(y, y + height)
            const box = { id: `hotspot-${Date.now()}`, name: 'Untitled', x: left, y: top, width: Math.abs(width), height: Math.abs(height) }
            if (box.width >= 4 && box.height >= 4 && box.y < 180) setDrawnHotspots((current) => [...current, box])
            setDraft(null)
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }} />}
        {artStackOrder(composition.entities.filter((item) => item.visible)).map((item, index) => { const blur = item.id.startsWith('bg-') ? item.blur : 0; return <img key={item.id} data-entity={item.id} data-blur={blur} alt={`Drag ${item.label}`} src={item.src} className={item.id === selected.id ? 'selected-sprite' : ''} draggable={false} onPointerDown={(event) => onPointerDown(event, item)} style={{ left: item.x * scale, top: item.y * scale, width: item.renderWidth * scale, height: renderHeight(item) * scale, zIndex: index + 1, pointerEvents: 'auto', cursor: 'grab', touchAction: 'none', outline: item.id === selected.id ? '2px solid #ffe092' : undefined, transform: item.mirror ? 'scaleX(-1)' : undefined, filter: blur > 0 ? `blur(${blur * scale}px)` : undefined }} /> })}
        <div className="layout-band" data-testid="art-layout-interface" style={{ fontSize: 7 * scale }}>
          <div className="layout-sentence" data-testid="art-layout-sentence">{hoveredItem ?? 'Walk to'}</div>
          <div className="layout-controls">
            <div className="layout-verbs" aria-hidden="true">{VERB_FACE.map((verb) => <span key={verb}>{verb}</span>)}</div>
            <div className="layout-inventory" data-testid="art-layout-inventory">
              <header><strong>INVENTORY</strong><small>{slots.filter(Boolean).length}/10</small></header>
              <div className="layout-slots">{slots.map((itemId, index) => {
                const item = itemId ? APPROVED_INVENTORY.find((entry) => entry.id === itemId) : null
                const name = itemId ? inventoryItems[itemId].name : `Empty inventory slot ${index + 1}`
                return <button type="button" className="layout-slot" key={index} aria-label={itemId ? `Remove ${name}` : name} onPointerEnter={() => itemId && setHoveredItem(name)} onPointerLeave={() => setHoveredItem(null)} onClick={() => setSlots((current) => current.map((entry, slot) => slot === index ? null : entry))}>{item && <img alt="" src={item.src} />}</button>
              })}</div>
            </div>
          </div>
        </div>
        {blackout && <div className="blackout-preview" data-testid="art-layout-blackout" />}
      </div>
    </div>
    <aside className="controls">
      <h2>{selected.label}</h2>
      <label>X <input aria-label="Logical x" type="number" value={selected.x} onChange={(event) => update(selected.id, { x: Number(event.target.value) })} /></label>
      <label>Y <input aria-label="Logical y" type="number" value={selected.y} onChange={(event) => update(selected.id, { y: Number(event.target.value) })} /></label>
      <label>Z <input aria-label="Z order" type="number" value={selected.z} onChange={(event) => update(selected.id, { z: Number(event.target.value) })} /></label>
      <label>Width <input aria-label="Render width" type="number" min={1} value={selected.renderWidth} onChange={(event) => update(selected.id, { renderWidth: Number(event.target.value) })} /></label>
      <p>Height {renderHeight(selected)} (aspect locked)</p>
      <label><input type="checkbox" checked={selected.visible} onChange={(event) => update(selected.id, { visible: event.target.checked })} /> Visible</label>
      <label><input type="checkbox" checked={selected.mirror} disabled={!selected.mirrorAllowed} onChange={(event) => update(selected.id, { mirror: event.target.checked })} /> Mirror</label>
      <label>State <select aria-label="Preview state" value={selected.state} onChange={(event) => update(selected.id, { state: event.target.value })}>{Object.keys(selected.states).map((state) => <option key={state}>{state}</option>)}</select></label>
      <h2>Layers</h2>
      <p>Drag a row onto another. The top of the list paints in front. Rook stays in front of every object, and the desk stays in front of Arthur. Showing the shelf or the books does not change Layout1 until you save.</p>
      <LayerStack items={composition.entities} onReorder={(frontToBack) => {
        const ordered = paintOrderFromFront(frontToBack)
        setComposition((current) => ({ ...current, principalDisposition: 'PENDING_PRINCIPAL_PLACEMENT', contentSha256: '', entities: current.entities.map((item) => { const index = ordered.indexOf(item.id); return index < 0 ? item : { ...item, z: (index + 1) * 10 } }) }))
      }} />
      <h2>Crop blur</h2>
      <p>Original crops. 0.00 is sharp. Each step is 0.05, up to {CROP_BLUR_MAX.toFixed(2)}. The picture updates as you move a slider.</p>
      {composition.entities.filter((item) => item.id.startsWith('bg-')).map((item) => <label className="crop-blur" key={item.id}>{item.label}<input aria-label={`Blur ${item.label}`} type="range" min={0} max={CROP_BLUR_MAX} step={CROP_BLUR_STEP} value={item.blur} onChange={(event) => { update(item.id, { blur: Number(event.target.value) }); setSelectedId(item.id) }} /><span>{item.blur.toFixed(2)}</span></label>)}
      <h2>Saved versions</h2>
      <p>Save the current placement and blur. Choose which saved version the live game uses.</p>
      <p data-testid="art-layout-default">{gameDefault ? `Game default: ${gameDefault.name}` : 'Game default: none. The live scene is using its built-in placement.'}</p>
      <label>Name <input aria-label="Version name" value={versionName} onChange={(event) => setVersionName(event.target.value)} /></label>
      <label><input type="checkbox" checked={makeDefaultOnSave} onChange={(event) => setMakeDefaultOnSave(event.target.checked)} /> Use this save as the game default</label>
      <button type="button" onClick={() => saveCurrentVersion()}>SAVE VERSION</button>
      <div className="layout-versions">{library.versions.map((version) => <article key={version.id}><strong>{version.name}</strong><div className="layout-version-actions"><button type="button" aria-label={`Load ${version.name}`} onClick={() => loadVersion(version)}>Load</button><button type="button" aria-label={`Use ${version.name} as the game default`} aria-pressed={version.id === library.defaultVersionId} onClick={() => chooseGameDefault(version)}>GAME DEFAULT</button><button type="button" onClick={() => { setLibrary(removeLayoutVersion(localStorage, version.id)); setMessage(version.id === library.defaultVersionId ? `Removed ${version.name}. The live scene is back to its built-in placement.` : `Removed ${version.name}.`) }}>Remove</button></div></article>)}</div>
      <a href="/?skipIntro=1">Open live scene</a>
      <h2>Approved inventory</h2>
      <div className="approved-items">{APPROVED_INVENTORY.map((item) => <button type="button" key={item.id} onClick={() => setSlots((current) => { const index = current.indexOf(null); if (index < 0) { setMessage('All ten inventory boxes are full.'); return current } const next = [...current]; next[index] = item.id; return next })}><img alt="" src={item.src} />{inventoryItems[item.id].name}</button>)}</div>
      <h2>Drawn hotspots</h2>
      <p>Drag on the picture while drawing is on. Name each box here, then tell me what it is.</p>
      <button type="button" aria-pressed={drawHotspot} onClick={() => setDrawHotspot((value) => !value)}>DRAW HOTSPOT {drawHotspot ? 'ON' : 'OFF'}</button>
      {drawnHotspots.map((hotspot) => <label key={hotspot.id}>{hotspot.width}×{hotspot.height} at {hotspot.x},{hotspot.y}<input aria-label={`Name for hotspot at ${hotspot.x},${hotspot.y}`} value={hotspot.name} onChange={(event) => setDrawnHotspots((current) => current.map((item) => item.id === hotspot.id ? { ...item, name: event.target.value } : item))} /><button type="button" onClick={() => setDrawnHotspots((current) => current.filter((item) => item.id !== hotspot.id))}>Remove</button></label>)}
      <button type="button" onClick={() => setBlackout((value) => !value)}>BLACKOUT</button>
      <button type="button" onClick={() => { setComposition(referenceComposition()); setSlots(Array.from({ length: 10 }, () => null)); setMessage('Reset the workbench to the reference composition. The game default is unchanged until you choose one.') }}>RESET</button>
      <button type="button" onClick={() => void capture()}>SCREENSHOT</button>
      <button type="button" data-testid="art-layout-export" onClick={() => void exportLayout()}>EXPORT</button>
      <label>Import <input aria-label="Import composition" type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImport(file) }} /></label>
    </aside>
    <footer data-testid="art-layout-status">{message}</footer>
  </main>
}
