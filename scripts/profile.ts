import { invoke } from '@tauri-apps/api/core';

async function measurePerformance(): Promise<void> {
  console.log('=== Ditto Performance Profile ===');

  const start = performance.now();
  for (let i = 0; i < 10; i++) {
    await invoke('get_care_state');
  }
  const elapsed = performance.now() - start;
  console.log(`10x get_care_state: ${elapsed.toFixed(1)}ms (${(elapsed / 10).toFixed(1)}ms avg)`);

  const triggerStart = performance.now();
  for (let i = 0; i < 10; i++) {
    await invoke('check_scheduled_triggers');
  }
  const triggerElapsed = performance.now() - triggerStart;
  console.log(`10x check_scheduled_triggers: ${triggerElapsed.toFixed(1)}ms (${(triggerElapsed / 10).toFixed(1)}ms avg)`);

  const settingsStart = performance.now();
  for (let i = 0; i < 10; i++) {
    await invoke('get_settings');
  }
  const settingsElapsed = performance.now() - settingsStart;
  console.log(`10x get_settings: ${settingsElapsed.toFixed(1)}ms (${(settingsElapsed / 10).toFixed(1)}ms avg)`);

  console.log('=== Profile Complete ===');
}

measurePerformance().catch(console.error);
