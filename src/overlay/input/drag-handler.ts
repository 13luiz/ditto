import { invoke } from '@tauri-apps/api/core';
import { PetController } from '../behavior/pet-controller';
import { ClickThroughHandler } from './click-through';

const DRAG_THRESHOLD = 5;

export class DragHandler {
  private controller: PetController;
  private clickThrough: ClickThroughHandler;
  private dragging = false;
  private pendingDrag = false;
  private startPhysX = 0;
  private startPhysY = 0;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, controller: PetController, clickThrough: ClickThroughHandler) {
    this.canvas = canvas;
    this.controller = controller;
    this.clickThrough = clickThrough;
  }

  attach(): void {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', () => this.onMouseMove());
    window.addEventListener('mouseup', () => this.onMouseUp());
  }

  private isOverOpaquePixel(e: MouseEvent): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) return false;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    return ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] >= 10;
  }

  private async getPhysicalCursor(): Promise<[number, number]> {
    try {
      return await invoke<[number, number]>('get_cursor_position');
    } catch {
      return [0, 0];
    }
  }

  private async onMouseDown(e: MouseEvent): Promise<void> {
    if (!this.isOverOpaquePixel(e)) return;
    this.clickThrough.setInteracting(true);
    const [px, py] = await this.getPhysicalCursor();
    this.pendingDrag = true;
    this.startPhysX = px;
    this.startPhysY = py;
  }

  private async onMouseMove(): Promise<void> {
    if (this.pendingDrag && !this.dragging) {
      const [px, py] = await this.getPhysicalCursor();
      const dx = px - this.startPhysX;
      const dy = py - this.startPhysY;
      if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        this.pendingDrag = false;
        this.dragging = true;
        this.controller.startDrag();
        this.controller.updateDrag(px, py);
      }
      return;
    }
    if (!this.dragging) return;
    const [px, py] = await this.getPhysicalCursor();
    this.controller.updateDrag(px, py);
  }

  private onMouseUp(): void {
    this.pendingDrag = false;
    if (!this.dragging) {
      setTimeout(() => this.clickThrough.setInteracting(false), 300);
      return;
    }
    this.dragging = false;
    this.controller.endDrag();
    setTimeout(() => this.clickThrough.setInteracting(false), 2000);
  }
}