import { openPetManager, closePetManager } from './pet-manager';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export async function openCarePanel(): Promise<void> {
  const existing = await WebviewWindow.getByLabel('pet-manager');
  if (existing) {
    await closePetManager();
    return;
  }
  await openPetManager('/care');
}

export async function closeCarePanel(): Promise<void> {
  await closePetManager();
}
