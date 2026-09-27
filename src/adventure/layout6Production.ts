import sealed from './layout6.production.json'
import { compositionBody, type SceneComposition } from './sceneComposition'

/** The one committed Layout6 composition. Production never reads browser storage. */
export const productionComposition = sealed as SceneComposition

export function productionCompositionBody(composition: SceneComposition = productionComposition) {
  return compositionBody({ ...composition, contentSha256: '' })
}
