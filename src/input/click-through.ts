import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

const ALPHA_THRESHOLD = 10;
const POLL_INTERVAL_MS = 50;

export class ClickThroughHandler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastIgnoreState: boolean | null = null;
  private intervalId: number | null = null;
  private interactionActive = false;
  private cachedScale = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    // Cache scale factor — refresh when window moves between monitors
    getCurrentWindow().scaleFactor().then(s => { this.cachedScale = s; }).catch(() => {});
    getCurrentWindow().onScaleChanged(({ payload }) => {
      this.cachedScale = payload.scaleFactor;
    });
  }

  /** Call when drag/click starts — pauses click-through polling */
  setInteracting(active: boolean) {
    this.interactionActive = active;
    if (active) {
      this.setCursorIgnore(false);
    }
  }

  async checkAndToggle(): Promise<void> {
    if (this.interactionActive) return;

    try {
      const [cursorPhysX, cursorPhysY] = await invoke<[number, number]>('get_cursor_position');
      const winPos = await getCurrentWindow().outerPosition();
      const canvasX = (cursorPhysX - winPos.x) / this.cachedScale;
      const canvasY = (cursorPhysY - winPos.y) / this.cachedScale;

      if (canvasX < 0 || canvasX >= this.canvas.width || canvasY < 0 || canvasY >= this.canvas.height) {
        await this.setCursorIgnore(true);
        return;
      }

      const alpha = this.getPixelAlpha(Math.floor(canvasX), Math.floor(canvasY));
      await this.setCursorIgnore(alpha < ALPHA_THRESHOLD);
    } catch { /* */ }
  }

  getPixelAlpha(x: number, y: number): number {
    if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) return 0;
    return this.ctx.getImageData(x, y, 1, 1).data[3];
  }

  async setCursorIgnore(ignore: boolean): Promise<void> {
    if (this.lastIgnoreState === ignore) return;
    this.lastIgnoreState = ignore;
    try {
      await invoke('set_ignore_cursor_events', { ignore });
    } catch { /* */ }
  }

  attach(): void {
    this.intervalId = window.setInterval(() => this.checkAndToggle(), POLL_INTERVAL_MS);
  }

  detach(): void {
    if (this.intervalId !== null) { clearInterval(this.intervalId); this.intervalId = null; }
  }
}
