import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export async function showOnboardingIfNeeded(): Promise<void> {
  const settings = await invoke<Record<string, string | null>>('get_settings');
  if (settings.onboarding_done === 'true') return;

  const existing = await WebviewWindow.getByLabel('onboarding');
  if (existing) return;

  new WebviewWindow('onboarding', {
    url: '/ui.html#/onboarding',
    width: 420,
    height: 400,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focus: true,
  });
}

export async function completeOnboarding(petName: string, providerConfig: string): Promise<void> {
  await invoke('save_settings', {
    settings: {
      pet_name: petName,
      provider_config: providerConfig,
      onboarding_done: 'true',
    },
  });
}
