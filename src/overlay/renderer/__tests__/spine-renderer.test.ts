import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpineRenderer } from '../spine-renderer';
import type { PetRenderer } from '../pet-renderer';
import { RendererFactory } from '../renderer-factory';

function createMockCanvas() {
  const canvas = document.createElement('canvas');
  const mockCtx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
  };
  vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);
  return canvas;
}

describe('SpineRenderer', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = createMockCanvas();
  });

  it('implements PetRenderer interface', () => {
    const renderer = new SpineRenderer(canvas);
    expect(renderer.type).toBe('spine');
    expect(typeof renderer.load).toBe('function');
    expect(typeof renderer.setState).toBe('function');
    expect(typeof renderer.hitTest).toBe('function');
    expect(typeof renderer.update).toBe('function');
    expect(typeof renderer.getCanvas).toBe('function');
    expect(typeof renderer.capabilities).toBe('function');
    expect(typeof renderer.destroy).toBe('function');
  });

  it('returns canvas from getCanvas', () => {
    const renderer = new SpineRenderer(canvas);
    expect(renderer.getCanvas()).toBe(canvas);
  });

  it('reports correct capabilities', () => {
    const renderer = new SpineRenderer(canvas);
    const caps = renderer.capabilities();
    expect(caps.expressionBlending).toBe(true);
    expect(caps.parameterDriving).toBe(true);
    expect(caps.physics).toBe(true);
    expect(caps.lipSync).toBe(false);
    expect(caps.multiLayer).toBe(false);
  });

  it('returns false from hitTest when skeleton not loaded', () => {
    const renderer = new SpineRenderer(canvas);
    expect(renderer.hitTest(32, 32)).toBe(false);
  });

  it('returns false from hitTest for out-of-bounds coordinates', () => {
    const renderer = new SpineRenderer(canvas);
    expect(renderer.hitTest(-1, 0)).toBe(false);
    expect(renderer.hitTest(0, -1)).toBe(false);
    expect(renderer.hitTest(100, 0)).toBe(false);
    expect(renderer.hitTest(0, 100)).toBe(false);
  });

  it('does not crash on update when not loaded', () => {
    const renderer = new SpineRenderer(canvas);
    expect(() => renderer.update(16)).not.toThrow();
  });

  it('does not crash on setState when not loaded', () => {
    const renderer = new SpineRenderer(canvas);
    expect(() => renderer.setState('idle')).not.toThrow();
  });

  it('does not crash on destroy when not loaded', () => {
    const renderer = new SpineRenderer(canvas);
    expect(() => renderer.destroy()).not.toThrow();
  });

  it('throws on load when spine config is missing', async () => {
    const renderer = new SpineRenderer(canvas);
    const manifest = {
      schema_version: '1.0',
      name: 'test',
      author: 'test',
      version: '1.0.0',
      renderer: 'spine' as const,
      size: { width: 64, height: 64 },
      state_map: {},
    };
    await expect(renderer.load(manifest)).rejects.toThrow('missing spine config');
  });
});

describe('RendererFactory dispatches SpineRenderer', () => {
  it('creates SpineRenderer for spine type', () => {
    const canvas = createMockCanvas();
    const renderer = RendererFactory.create('spine', canvas);
    expect(renderer).toBeInstanceOf(SpineRenderer);
    expect(renderer.type).toBe('spine');
  });
});
