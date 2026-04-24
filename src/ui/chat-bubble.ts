import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';

let chatWindow: WebviewWindow | null = null;

export async function toggleChatWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel('chat');
  if (existing) {
    await existing.destroy();
    return;
  }

  const petWin = getCurrentWindow();
  const pos = await petWin.outerPosition();
  const scale = await petWin.scaleFactor();

  // Convert physical position to logical for WebviewWindow x/y options
  const petLogX = pos.x / scale;
  const petLogY = pos.y / scale;
  const petLogW = 64; // logical pet width

  const chatW = 300;
  const chatH = 420;

  const chatX = petLogX + petLogW / 2 - chatW / 2;
  const chatY = petLogY - chatH;

  console.log(`[ditto] creating chat JS window at (${chatX}, ${chatY})`);

  chatWindow = new WebviewWindow('chat', {
    url: '/chat.html',
    width: chatW,
    height: chatH,
    x: chatX,
    y: chatY,
    transparent: false,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focus: true,
  });

  chatWindow.once('tauri://close-requested', () => {
    chatWindow = null;
  });

  await chatWindow.once('tauri://created', () => {
    console.log('[ditto] chat window created');
  });
}
