export interface TarkaBuildBinding {
  schema: 'tarka.build-binding.v1'
  commit: string
  tree: string
  buildId: string
  buildRoot: string
}

export const TARKA_BUILD_BINDING: Readonly<TarkaBuildBinding> = Object.freeze({
  schema: 'tarka.build-binding.v1',
  commit: import.meta.env.VITE_TARKA_BUILD_COMMIT || 'DEV_UNBOUND',
  tree: import.meta.env.VITE_TARKA_BUILD_TREE || 'DEV_UNBOUND',
  buildId: import.meta.env.VITE_TARKA_BUILD_ID || 'DEV_UNBOUND',
  buildRoot: import.meta.env.VITE_TARKA_BUILD_ROOT || 'DEV_UNBOUND',
})

declare global {
  interface Window {
    __TARKA_BUILD__: Readonly<TarkaBuildBinding>
  }
}

export function exposeBuildBinding() {
  window.__TARKA_BUILD__ = TARKA_BUILD_BINDING
}
