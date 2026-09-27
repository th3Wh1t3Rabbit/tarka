/**
 * Browser/Node-safe compiled projection of the sealed Layout7 facts used by
 * the shared window owner. The R5 qualification test proves these values are
 * byte-for-value aligned with layout7.production.json.
 */
export const PRODUCTION_WINDOW_LAYOUT = {
  roomWidth: 480,
  cabinets: [
    { id: 'misc-cabinet', x: 303, renderWidth: 50 },
    { id: 'official-cabinet', x: 371, renderWidth: 50 },
  ],
  stanchion: { id: 'bg-sign-you-are-not-a-number', x: 445, y: 107, sourceWidth: 111, sourceHeight: 87, renderWidth: 32 },
} as const
