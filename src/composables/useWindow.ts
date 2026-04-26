import { getCurrentWindow } from '@tauri-apps/api/window'

export function useWindow() {
  const appWindow = getCurrentWindow()

  async function close() {
    await appWindow.destroy()
  }

  return { close }
}
