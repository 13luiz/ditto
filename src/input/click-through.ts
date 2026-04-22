import { invoke } from '@tauri-apps/api/core';

const ALPHA_THRESHOLD = 10;
const POLL_INTERVAL_MS = 50;

export class ClickThroughHandler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastIgnoreState: boolean | null = null;
  private intervalId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
  }

  async checkAndToggle(): Promise<void> {
    try {
      const [cursorScreenX, cursorScreenY] = await invoke<[number, number]>('get_cursor_position');
      const rect = this.canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;

      // cursor_position() returns physical pixels; screenX/Y return CSS pixels — divide by DPI to match
      const winX = window.screenX;
      const winY = window.screenY;
      const localX = (cursorScreenX / scale) - winX;
      const localY = (cursorScreenY / scale) - winY;

      // Convert to canvas-local coords
      const canvasX = localX - rect.left;
      const canvasY = localY - rect.top;

      if (canvasX < 0 || canvasX >= this.canvas.width || canvasY < 0 || canvasY >= this.canvas.height) {
        await this.setCursorIgnore(true);
        return;
      }

      const alpha = this.getPixelAlpha(Math.floor(canvasX), Math.floor(canvasY));
      await this.setCursorIgnore(alpha < ALPHA_THRESHOLD);
    } catch {
      // Non-Tauri environment, skip
    }
  }

  getPixelAlpha(x: number, y: number): number {
    if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
      return 0;
    }
    const pixel = this.ctx.getImageData(x, y, 1, 1).data;
    return pixel[3];
  }

  async setCursorIgnore(ignore: boolean): Promise<void> {
    if (this.lastIgnoreState === ignore) return;
    this.lastIgnoreState = ignore;
    try {
      await invoke('set_ignore_cursor_events', { ignore });
    } catch {
      // Non-Tauri environment
    }
  }

  attach(): void {
    this.intervalId = window.setInterval(() => {
      this.checkAndToggle();
    }, POLL_INTERVAL_MS);
  }

  detach(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
