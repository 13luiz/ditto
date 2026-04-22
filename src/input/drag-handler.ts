import { invoke } from '@tauri-apps/api/core';
import { PetController } from '../behavior/pet-controller';

export class DragHandler {
  private controller: PetController;
  private dragging: boolean = false;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, controller: PetController) {
    this.canvas = canvas;
    this.controller = controller;
  }

  attach(): void {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
  }

  private async onMouseDown(e: MouseEvent): Promise<void> {
    // Check if clicking on non-transparent pixel
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) return;

    const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    if (pixel[3] < 10) return; // transparent area

    this.dragging = true;
    this.controller.startDrag();

    // Enable pointer events on the window for dragging
    try {
      await invoke('set_ignore_cursor_events', { ignore: false });
    } catch {
      // Non-Tauri
    }

    e.preventDefault();
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.dragging) return;
    this.controller.updateDrag(e.screenX, e.screenY);
  }

  private async onMouseUp(): Promise<void> {
    if (!this.dragging) return;
    this.dragging = false;
    this.controller.endDrag();
    try {
      await invoke('set_ignore_cursor_events', { ignore: true });
    } catch {
      // Non-Tauri
    }
  }
}
