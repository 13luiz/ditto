import { invoke } from '@tauri-apps/api/core';

const ALPHA_THRESHOLD = 10;

export class ClickThroughHandler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastIgnoreState: boolean | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
  }

  async handleMouseMove(clientX: number, clientY: number): Promise<void> {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
      await this.setCursorIgnore(true);
      return;
    }

    const alpha = this.getPixelAlpha(Math.floor(x), Math.floor(y));
    const isTransparent = alpha < ALPHA_THRESHOLD;
    await this.setCursorIgnore(isTransparent);
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
      // Ignore errors in non-Tauri environment (e.g. browser dev)
    }
  }

  attach(): void {
    document.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e.clientX, e.clientY);
    });
  }
}
