import { getCurrentWindow } from '@tauri-apps/api/window'

const isTauri = '__TAURI_INTERNALS__' in globalThis

export function useWindow() {
  async function close() {
    if (isTauri) {
      await getCurrentWindow().destroy()
    }
  }

  return { close }
}
