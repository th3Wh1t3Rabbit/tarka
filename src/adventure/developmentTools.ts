export const DEV_TOOL_FLAGS = ['artLayout', 'animDirector', 'detailReview', 'r55Review'] as const
export type DevToolFlag = (typeof DEV_TOOL_FLAGS)[number]

/** Compile-time dev authority is required. A query flag alone cannot open a tool. */
export function devToolActive(dev: boolean, params: Pick<URLSearchParams, 'get'>, flag: DevToolFlag): boolean {
  return dev && params.get(flag) === '1'
}
