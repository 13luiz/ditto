import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';

export async function openPetManager(route = '/chat'): Promise<void> {
  const existing = await WebviewWindow.getByLabel('pet-manager');
  if (existing) {
    await existing.setFocus();
    return;
  }

  const petWin = getCurrentWindow();
  const pos = await petWin.outerPosition();
  const scale = await petWin.scaleFactor();

  const pmW = 380;
  const pmH = 500;

  const pmX = (pos.x / scale) + 64 + 8;
  const pmY = (pos.y / scale) - pmH / 2;

  new WebviewWindow('pet-manager', {
    url: `/ui.html#${route}`,
    width: pmW,
    height: pmH,
    x: pmX,
    y: pmY,
    transparent: false,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focus: true,
  });
}

export async function closePetManager(): Promise<void> {
  const existing = await WebviewWindow.getByLabel('pet-manager');
  if (existing) {
    await existing.destroy();
  }
}
