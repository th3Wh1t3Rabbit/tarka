const INVENTORY_SHORT: Record<string, string> = {
  'blank authorization form': 'form',
  'loose feather pen': 'pen',
  'signed form with doodles': 'signed',
  'broken feather pen': 'broken pen',
  'approved stamped form': 'stamped',
  'Euler case file': 'case file',
  'rubber band': 'band',
  "Rubik's Cube": 'cube',
  'Sharknado 2 VHS': 'vhs',
  'piggy bank': 'piggy',
  'small toolbox': 'toolbox',
  'open empty toolbox': 'toolbox',
  hammer: 'hammer',
  nails: 'nails',
  'office-note token lead': 'note',
}

export function inventoryVisibleLabel(name: string) {
  return INVENTORY_SHORT[name] ?? name
}
