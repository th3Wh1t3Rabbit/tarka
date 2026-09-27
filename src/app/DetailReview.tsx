import { useState } from 'react'
import './detail-review.css'

const ASSETS = [
  ['bg-poster-be-the-change.png', 'Be the Change poster'],
  ['bg-poster-think-outside-the-box.png', 'Think Outside the Box poster'],
  ['bg-wall-clock.png', 'Wall clock'],
  ['bg-plaque-employee-of-the-month.png', 'Employee of the Month'],
  ['bg-painting-city-bridge.png', 'City bridge painting'],
  ['bg-print-building.png', 'Building print'],
  ['bg-plaque-preserve-serve-remember.png', 'Preserve Serve Remember'],
  ['bg-sign-records-office.png', 'Records Office sign'],
  ['bg-sign-you-are-not-a-number.png', 'You Are Not a Number'],
] as const

export function DetailReview() {
  const [ground, setGround] = useState<'black' | 'white'>('black')
  return <main className="detail-review" data-testid="detail-review" data-ground={ground}>
    <header>
      <h1>Background detail crops</h1>
      <p>Your square cuts, with the wall cleared. Not placed in the scene. Switch the ground to check the edges.</p>
      <div>
        <button type="button" aria-pressed={ground === 'black'} onClick={() => setGround('black')}>BLACK</button>
        <button type="button" aria-pressed={ground === 'white'} onClick={() => setGround('white')}>WHITE</button>
      </div>
    </header>
    <div className="detail-grid">
      {ASSETS.map(([file, label]) => <figure key={file} style={{ background: ground === 'black' ? '#000' : '#fff' }}>
        <img src={`/art-review/background-detail/${file}`} alt={label} />
        <figcaption>{label}<small>{file}</small></figcaption>
      </figure>)}
    </div>
  </main>
}
