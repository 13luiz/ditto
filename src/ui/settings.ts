import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export async function openSettingsWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel('settings');
  if (existing) {
    await existing.setFocus();
    return;
  }

  new WebviewWindow('settings', {
    url: '/settings.html',
    width: 420,
    height: 500,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focus: true,
  });
}

export async function loadSettings(): Promise<Record<string, unknown>> {
  return await invoke<Record<string, unknown>>('get_settings');
}

export async function saveAllSettings(settings: Record<string, string>): Promise<void> {
  await invoke('save_settings', { settings });
}
