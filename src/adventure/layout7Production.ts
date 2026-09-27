import { compositionBody, type SceneComposition } from './sceneComposition'
import sealed from './layout7.production.json'

/** Principal approval for the Layout7 placement. The donor file is not production authority. */
export const LAYOUT7_APPROVAL = {
  name: 'SCENE_COMPOSITION_PRINCIPAL',
  versionId: 'layout-1790193367475-39rhwq',
  savedAt: '2026-09-23T19:56:07.475Z',
  inputSha256: '9245df2b66e359652ddbad36f548e39fff09e8003473b8936ded067c8481f3e3',
} as const

export const productionComposition = sealed as SceneComposition

export function productionCompositionBody(composition: SceneComposition = productionComposition) {
  return compositionBody({ ...composition, contentSha256: '' })
}
