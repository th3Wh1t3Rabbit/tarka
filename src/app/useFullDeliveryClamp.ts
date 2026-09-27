import { useCallback, useLayoutEffect, useRef, useState } from 'react'

function desiredPixels(value: React.CSSProperties['left'], parentWidth: number) {
  if (typeof value === 'string' && value.endsWith('%')) return parentWidth * Number.parseFloat(value) / 100
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : parentWidth / 2
}

/** Shared full-delivery owner for blocking and nonblocking overhead speech. */
export function useFullDeliveryClamp(fullText: string, desiredLeft: React.CSSProperties['left']) {
  const deliveryKey = `${fullText}\u0000${String(desiredLeft ?? '')}`
  const node = useRef<HTMLElement | null>(null)
  const measure = useRef<HTMLSpanElement | null>(null)
  const nodeRef = useCallback((value: HTMLElement | null) => { node.current = value }, [])
  const measureRef = useCallback((value: HTMLSpanElement | null) => { measure.current = value }, [])
  const [geometry, setGeometry] = useState<{ key: string; left: React.CSSProperties['left']; width?: number; scale?: number }>({ key: deliveryKey, left: desiredLeft })
  useLayoutEffect(() => {
    const element = node.current
    const fullDelivery = measure.current
    const parent = element?.offsetParent as HTMLElement | null
    if (!element || !fullDelivery || !parent) return
    let frame = 0
    const measureNow = () => {
      const margin = 8 * Math.max(1, parent.clientWidth / 480)
      const naturalWidth = fullDelivery.scrollWidth || fullDelivery.getBoundingClientRect().width
      const available = Math.max(1, parent.clientWidth - margin * 2)
      const scale = Math.min(1, available / naturalWidth)
      const width = naturalWidth * scale
      const half = width / 2
      const desired = desiredPixels(desiredLeft, parent.clientWidth)
      setGeometry({ key: deliveryKey, left: Math.max(margin + half, Math.min(parent.clientWidth - margin - half, desired)), width, scale })
    }
    const recompute = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measureNow)
    }
    // The first measurement must finish before paint. Deferring it by a frame
    // lets the incoming line render with the previous line's X/width/scale.
    measureNow()
    const observer = new ResizeObserver(recompute)
    observer.observe(parent)
    observer.observe(fullDelivery)
    const fonts = document.fonts
    void fonts.ready.then(recompute)
    fonts.addEventListener?.('loadingdone', recompute)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      fonts.removeEventListener?.('loadingdone', recompute)
    }
  }, [deliveryKey, desiredLeft])
  const current = geometry.key === deliveryKey ? geometry : { key: deliveryKey, left: desiredLeft }
  return {
    nodeRef,
    measureRef,
    clampStyle: { left: current.left, ...(current.width == null ? {} : { width: current.width }), ...(current.scale == null ? {} : { transform: `translate(-50%, -115%) scale(${current.scale})`, transformOrigin: '50% 100%' }) } as React.CSSProperties,
    fullDeliveryWidth: current.width,
    deliveryKey,
  }
}
