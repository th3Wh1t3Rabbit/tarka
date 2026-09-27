import { useEffect, useState } from 'react'

export function useIntegerViewportScale() {
  const size = () => Math.max(1, Math.floor(Math.min(window.innerWidth / 480, window.innerHeight / 270)))
  const [scale, setScale] = useState(size)
  useEffect(() => { const resize = () => setScale(size()); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize) }, [])
  return scale
}
