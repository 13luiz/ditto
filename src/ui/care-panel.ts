import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';

export async function openCarePanel(): Promise<void> {
  const existing = await WebviewWindow.getByLabel('care');
  if (existing) {
    await existing.destroy();
    return;
  }

  const petWin = getCurrentWindow();
  const pos = await petWin.outerPosition();
  const scale = await petWin.scaleFactor();

  const petLogX = pos.x / scale;
  const petLogY = pos.y / scale;

  const careW = 220;
  const careH = 260;

  const careX = petLogX + 64 + 8;
  const careY = petLogY - careH / 2;

  new WebviewWindow('care', {
    url: '/care.html',
    width: careW,
    height: careH,
    x: careX,
    y: careY,
    transparent: false,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focus: true,
  });
}

export async function closeCarePanel(): Promise<void> {
  const existing = await WebviewWindow.getByLabel('care');
  if (existing) {
    await existing.destroy();
  }
}
