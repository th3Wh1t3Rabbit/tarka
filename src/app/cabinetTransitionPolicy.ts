export type CabinetTransitionFamily = 'OFFICIAL_FILED_DRAWER_02' | 'MISC_DRAWER_04' | 'NONE'

export interface CabinetTransitionPlan {
  family: CabinetTransitionFamily
  frames: string[]
}

const OFFICIAL_ROOT = '/art-packs/production/files/production/furniture/cabinet-contents/frames'
const MISC_ROOT = '/art-packs/production/files/production/furniture/lower-drawers/drawer-04/frames'

function six(root: string, stem: string) {
  return Array.from({ length: 6 }, (_, index) => `${root}/${stem}${String(index + 1).padStart(2, '0')}.png`)
}

/** Selects a drawer transition from the visual that is actually on screen. */
export function cabinetTransitionPlan(itemId: string, source: string, target: string): CabinetTransitionPlan {
  void source
  void target
  if (itemId === 'misc-cabinet') return { family: 'MISC_DRAWER_04', frames: six(MISC_ROOT, 'cabinet_open__drawer_04_phase_') }
  if (itemId !== 'official-cabinet') return { family: 'NONE', frames: [] }
  return { family: 'OFFICIAL_FILED_DRAWER_02', frames: six(OFFICIAL_ROOT, 'cabinet_open__drawer_02_filed_phase_') }
}
