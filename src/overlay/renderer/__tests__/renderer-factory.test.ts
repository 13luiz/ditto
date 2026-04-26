import { describe, it, expect, vi } from 'vitest';
import type { PetRenderer, SkinManifest } from '../pet-renderer';
import { RendererFactory } from '../renderer-factory';
import { SpriteRenderer } from '../sprite-renderer';

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const mockCtx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
  };
  vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);
  return canvas;
}

describe('RendererFactory', () => {
  it('creates SpriteRenderer for "sprite" type', () => {
    const canvas = createMockCanvas();
    const renderer = RendererFactory.create('sprite', canvas);
    expect(renderer).toBeInstanceOf(SpriteRenderer);
    expect(renderer.type).toBe('sprite');
  });

  it('throws descriptive error for unknown renderer type', () => {
    const canvas = createMockCanvas();
    expect(() => RendererFactory.create('unknown' as any, canvas)).toThrow(/unsupported renderer/i);
  });

  it('created renderer implements PetRenderer interface', () => {
    const canvas = createMockCanvas();
    const renderer: PetRenderer = RendererFactory.create('sprite', canvas);
    expect(typeof renderer.load).toBe('function');
    expect(typeof renderer.setState).toBe('function');
    expect(typeof renderer.hitTest).toBe('function');
    expect(typeof renderer.update).toBe('function');
    expect(typeof renderer.getCanvas).toBe('function');
    expect(typeof renderer.capabilities).toBe('function');
    expect(typeof renderer.destroy).toBe('function');
  });
});
