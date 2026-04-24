import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

let currentStep = 1;
const totalSteps = 2;

function showStep(step: number): void {
  for (let i = 1; i <= totalSteps; i++) {
    const el = document.getElementById(`step-${i}`);
    if (el) el.classList.toggle('active', i === step);
  }
  const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
  nextBtn.textContent = step === totalSteps ? 'Finish' : 'Next';
}

async function finish(): Promise<void> {
  const petName = (document.getElementById('pet-name') as HTMLInputElement).value || 'Ditto';
  const providerType = (document.getElementById('provider-type') as HTMLSelectElement).value;
  const apiKey = (document.getElementById('api-key') as HTMLInputElement).value;
  const model = (document.getElementById('model') as HTMLInputElement).value;

  let providerConfig = '';
  if (providerType) {
    const config: Record<string, string> = { type: providerType, model: model || 'gpt-4o' };
    if (apiKey) config.api_key = apiKey;
    providerConfig = JSON.stringify(config);
  }

  await invoke('save_settings', {
    settings: {
      pet_name: petName,
      provider_config: providerConfig,
      onboarding_done: 'true',
    },
  });

  await getCurrentWindow().destroy();
}

async function main(): Promise<void> {
  document.getElementById('next-btn')?.addEventListener('click', async () => {
    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    } else {
      await finish();
    }
  });

  document.getElementById('skip-btn')?.addEventListener('click', async () => {
    await invoke('save_settings', { settings: { onboarding_done: 'true' } });
    await getCurrentWindow().destroy();
  });

  showStep(1);
}

main().catch(console.error);
