import { useEffect, useState } from 'react'
import type { CaseFixture, Presentation } from '../investigation/contracts'
import type { CorpusView, SemanticCard } from '../investigation/semantic-ux/model'
import { controllerCorpus } from '../controller/corpus/input'
import { CorpusPresentation } from './corpus-presentation/CorpusPresentation'

export function AcceptedEvidenceSea({ fixture, mode, onInspect }: { fixture: CaseFixture; mode: Presentation; onInspect?: (card: SemanticCard) => void }) {
  const [result, setResult] = useState<{ fixture: CaseFixture; view: CorpusView | null; error: boolean } | null>(null)
  useEffect(() => {
    let current = true
    controllerCorpus(fixture).then(view => { if (current) setResult({fixture,view,error:false}) }).catch(() => { if (current) setResult({fixture,view:null,error:true}) })
    return () => { current = false }
  }, [fixture])
  return <section aria-label="Semantic evidence sea" data-testid="semantic-evidence-sea">
    {result?.fixture === fixture && result.error ? <p role="alert">Canonical evidence sea unavailable for this unrecognized fixture. No substitute is represented as accepted evidence.</p>
      : result?.fixture === fixture && result.view ? <CorpusPresentation view={result.view} mode={mode} surface="EXPLORE" onInspect={onInspect}/>
        : <p role="status">Admitting local semantic display records…</p>}
  </section>
}
