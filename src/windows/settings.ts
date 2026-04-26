import { invoke } from '@tauri-apps/api/core';
import { openPetManager } from './pet-manager';

export async function openSettingsWindow(): Promise<void> {
  await openPetManager('/settings');
}

export async function loadSettings(): Promise<Record<string, unknown>> {
  return await invoke<Record<string, unknown>>('get_settings');
}

export async function saveAllSettings(settings: Record<string, string>): Promise<void> {
  await invoke('save_settings', { settings });
}
