/** R55 structural identities. Dialogue copy is intentionally not bound. */
export interface StructuralHotspotRow {
  r55Id: string
  name: string
  runtimeId: string | null
  layoutEntityId: string | null
  assetId: string | null
  visibilityOwner: string
  contactOwner: string
}

export interface StructuralInventoryRow {
  r55Id: string
  name: string
  runtimeId: string
}

export const ABSENT_NO_HOTSPOT = ['TROPHY_IMAGE', 'ENTRY_OR_EXIT_DOOR'] as const
export const NON_HOTSPOT_SET_DRESSING = ['DESK_SURFACE', 'CHAIRS', 'LOOSE_BACKGROUND_PAPERS', 'SECONDARY_OR_INDISTINCT_DECOR'] as const

export const STRUCTURAL_HOTSPOTS: readonly StructuralHotspotRow[] = [
  { r55Id: 'W01', name: 'Arthur', runtimeId: 'mr-index', layoutEntityId: 'arthur', assetId: 'arthur.idle', visibilityOwner: 'layout', contactOwner: 'mr-index' },
  { r55Id: 'W02', name: 'Nansen Case Terminal', runtimeId: 'nansen-terminal', layoutEntityId: 'terminal', assetId: 'terminal.kiosk', visibilityOwner: 'layout', contactOwner: 'nansen-terminal' },
  { r55Id: 'W03', name: 'Terminal Authorization Form Dispenser', runtimeId: 'request-dispenser', layoutEntityId: 'dispenser', assetId: 'dispenser', visibilityOwner: 'layout', contactOwner: 'request-dispenser' },
  { r55Id: 'W04', name: 'Protruding Blank Authorization Form', runtimeId: 'blank-authorization-form', layoutEntityId: 'blank-form', assetId: 'form.blank', visibilityOwner: 'phase-and-inventory', contactOwner: 'blank-authorization-form' },
  { r55Id: 'W05', name: 'Feather Pen / Inkwell', runtimeId: 'pen-stand', layoutEntityId: 'penstand', assetId: 'penstand', visibilityOwner: 'pen-taken-swaps-art', contactOwner: 'pen-stand-until-taken' },
  { r55Id: 'W06', name: 'Official Case-File Cabinet', runtimeId: 'official-case-file-cabinet', layoutEntityId: 'official-cabinet', assetId: 'cabinet.official', visibilityOwner: 'layout', contactOwner: 'official-case-file-cabinet' },
  { r55Id: 'W07', name: 'Disorderly Confidential File Stack', runtimeId: 'disorderly-stack-of-confidential-files', layoutEntityId: 'official-cabinet', assetId: 'cabinet.official', visibilityOwner: 'drawer-open-unsearched', contactOwner: 'disorderly-stack-of-confidential-files' },
  { r55Id: 'W08', name: 'Miscellaneous Cabinet', runtimeId: 'miscellaneous-drawer-cabinet', layoutEntityId: 'misc-cabinet', assetId: 'cabinet.misc', visibilityOwner: 'layout', contactOwner: 'miscellaneous-drawer-cabinet' },
  { r55Id: 'W09', name: 'Miscellaneous Catch-All Contents', runtimeId: 'miscellaneous-catch-all-contents', layoutEntityId: 'misc-cabinet', assetId: 'cabinet.misc', visibilityOwner: 'drawer-open-uncollected', contactOwner: 'miscellaneous-catch-all-contents' },
  { r55Id: 'W10', name: 'Spinning Globe', runtimeId: 'office-globe', layoutEntityId: 'globe', assetId: 'globe', visibilityOwner: 'layout', contactOwner: 'office-globe' },
  { r55Id: 'W11', name: 'Be the Change Poster', runtimeId: 'wall-be-the-change', layoutEntityId: 'bg-poster-be-the-change', assetId: 'bg-poster-be-the-change', visibilityOwner: 'layout', contactOwner: 'wall-be-the-change' },
  { r55Id: 'W12', name: 'Think Outside the Box Poster', runtimeId: 'wall-think-outside', layoutEntityId: 'bg-poster-think-outside-the-box', assetId: 'bg-poster-think-outside-the-box', visibilityOwner: 'layout', contactOwner: 'wall-think-outside' },
  { r55Id: 'W13', name: 'Analog Wall Clock', runtimeId: 'wall-clock', layoutEntityId: 'bg-wall-clock', assetId: 'bg-wall-clock', visibilityOwner: 'layout', contactOwner: 'wall-clock' },
  { r55Id: 'W14', name: 'Employee of the Month — Ron Gilbert', runtimeId: 'wall-employee', layoutEntityId: 'bg-plaque-employee-of-the-month', assetId: 'bg-plaque-employee-of-the-month', visibilityOwner: 'layout', contactOwner: 'wall-employee' },
  { r55Id: 'W15', name: 'City / Bridge / Water Picture', runtimeId: 'wall-city-bridge', layoutEntityId: 'bg-painting-city-bridge', assetId: 'bg-painting-city-bridge', visibilityOwner: 'layout', contactOwner: 'wall-city-bridge' },
  { r55Id: 'W16', name: 'Building Blueprints', runtimeId: 'wall-building', layoutEntityId: 'bg-print-building', assetId: 'bg-print-building', visibilityOwner: 'layout', contactOwner: 'wall-building' },
  { r55Id: 'W17', name: 'Preserve / Serve / Remember Frame', runtimeId: 'wall-preserve', layoutEntityId: 'bg-plaque-preserve-serve-remember', assetId: 'bg-plaque-preserve-serve-remember', visibilityOwner: 'layout', contactOwner: 'wall-preserve' },
  { r55Id: 'W18', name: 'Records Office Sign', runtimeId: 'wall-records-sign', layoutEntityId: 'bg-sign-records-office', assetId: 'bg-sign-records-office', visibilityOwner: 'layout', contactOwner: 'wall-records-sign' },
  { r55Id: 'W19', name: 'Stanchion Number Sign', runtimeId: 'wall-not-a-number', layoutEntityId: 'bg-sign-you-are-not-a-number', assetId: 'bg-sign-you-are-not-a-number', visibilityOwner: 'layout', contactOwner: 'wall-not-a-number' },
  { r55Id: 'W20', name: 'Window', runtimeId: 'window', layoutEntityId: null, assetId: 'room-plate', visibilityOwner: 'room-plate', contactOwner: 'window' },
  { r55Id: 'W21', name: 'Bookshelf', runtimeId: 'book-shelf', layoutEntityId: 'shelf', assetId: 'shelf', visibilityOwner: 'layout', contactOwner: 'book-shelf' },
  { r55Id: 'W22', name: 'Desk Lamp', runtimeId: 'desk-lamp', layoutEntityId: 'lamp', assetId: 'lamp', visibilityOwner: 'layout', contactOwner: 'desk-lamp' },
  { r55Id: 'W23', name: 'Approval Stamp and Ink Pad', runtimeId: 'arthur-stamp', layoutEntityId: 'arthur-stamp', assetId: 'stamp.world', visibilityOwner: 'layout', contactOwner: 'arthur-stamp' },
  { r55Id: 'W24', name: "Arthur's Coffee Mug", runtimeId: 'coffee-mug', layoutEntityId: 'mug', assetId: 'mug', visibilityOwner: 'layout', contactOwner: 'coffee-mug' },
]

export const STRUCTURAL_INVENTORY: readonly StructuralInventoryRow[] = [
  { r55Id: 'I01', name: 'Blank Terminal Authorization Form', runtimeId: 'blank-terminal-authorization-form' },
  { r55Id: 'I02', name: 'Feather Pen', runtimeId: 'loose-feather-pen' },
  { r55Id: 'I03', name: 'Barely Legible Signed Authorization Form', runtimeId: 'signed-terminal-authorization-form-with-doodles' },
  { r55Id: 'I04', name: 'Poorly Mishandled Broken Feather Pen', runtimeId: 'broken-feather-pen' },
  { r55Id: 'I05', name: 'Approved Authorization Form with Doodles', runtimeId: 'approved-stamped-terminal-authorization-form' },
  { r55Id: 'I06', name: 'Euler Case File', runtimeId: 'euler-case-file' },
  { r55Id: 'I07', name: 'Rubber Band', runtimeId: 'rubber-band' },
  { r55Id: 'I08', name: "Rubik's Cube", runtimeId: 'rubiks-cube' },
  { r55Id: 'I09', name: 'Sharknado 2 VHS', runtimeId: 'sharknado-2-vhs' },
  { r55Id: 'I10', name: 'Piggy Bank', runtimeId: 'piggy-bank-intact' },
  { r55Id: 'I11', name: 'Do-It-Herself Small Pink Toolbox', runtimeId: 'small-toolbox-closed' },
  { r55Id: 'I12', name: 'Heavy-Duty Hammer', runtimeId: 'hammer' },
  { r55Id: 'I13', name: 'Small Handful of Dainty Nails', runtimeId: 'nails' },
  { r55Id: 'I14', name: 'Mysterious Note with Porcelain Collateral', runtimeId: 'fictional-token-note' },
]

export function structuralOwners() {
  const owners = new Map<string, string>()
  for (const row of STRUCTURAL_HOTSPOTS) {
    if (!row.runtimeId) continue
    const previous = owners.get(row.runtimeId)
    if (previous) throw new Error(`two semantic owners for ${row.runtimeId}: ${previous} and ${row.r55Id}`)
    owners.set(row.runtimeId, row.r55Id)
  }
  return owners
}
