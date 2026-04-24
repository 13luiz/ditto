import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface Settings {
  provider_config: string | null;
  pet_name: string | null;
  auto_launch: string | null;
}

async function loadSettings(): Promise<Settings> {
  return await invoke<Settings>('get_settings');
}

async function saveSettings(settings: Record<string, string>): Promise<void> {
  await invoke('save_settings', { settings });
}

function populateForm(settings: Settings): void {
  const petName = document.getElementById('pet-name') as HTMLInputElement;
  const providerType = document.getElementById('provider-type') as HTMLSelectElement;
  const apiKey = document.getElementById('api-key') as HTMLInputElement;
  const model = document.getElementById('model') as HTMLInputElement;
  const baseUrl = document.getElementById('base-url') as HTMLInputElement;
  const autoLaunch = document.getElementById('auto-launch') as HTMLInputElement;

  if (settings.pet_name) petName.value = settings.pet_name;
  if (settings.auto_launch === 'true') autoLaunch.checked = true;

  if (settings.provider_config) {
    try {
      const config = JSON.parse(settings.provider_config);
      if (config.type) providerType.value = config.type;
      if (config.api_key) apiKey.value = config.api_key;
      if (config.model) model.value = config.model;
      if (config.base_url) baseUrl.value = config.base_url;
    } catch { /* ignore parse errors */ }
  }
}

function collectSettings(): Record<string, string> {
  const petName = (document.getElementById('pet-name') as HTMLInputElement).value;
  const providerType = (document.getElementById('provider-type') as HTMLSelectElement).value;
  const apiKey = (document.getElementById('api-key') as HTMLInputElement).value;
  const model = (document.getElementById('model') as HTMLInputElement).value;
  const baseUrl = (document.getElementById('base-url') as HTMLInputElement).value;
  const autoLaunch = (document.getElementById('auto-launch') as HTMLInputElement).checked;

  const result: Record<string, string> = {};

  if (petName) result.pet_name = petName;
  result.auto_launch = autoLaunch.toString();

  if (providerType) {
    const config: Record<string, string> = { type: providerType, model: model || 'gpt-4o' };
    if (apiKey) config.api_key = apiKey;
    if (baseUrl) config.base_url = baseUrl;
    result.provider_config = JSON.stringify(config);
  }

  return result;
}

async function main(): Promise<void> {
  const settings = await loadSettings();
  populateForm(settings);

  document.getElementById('close-btn')?.addEventListener('click', () => {
    getCurrentWindow().destroy();
  });

  document.getElementById('cancel-btn')?.addEventListener('click', () => {
    getCurrentWindow().destroy();
  });

  document.getElementById('save-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('status')!;
    try {
      const settings = collectSettings();
      await saveSettings(settings);
      status.textContent = 'Settings saved!';
      setTimeout(() => { getCurrentWindow().destroy(); }, 800);
    } catch (e) {
      status.textContent = `Error: ${e}`;
    }
  });
}

main().catch(console.error);
