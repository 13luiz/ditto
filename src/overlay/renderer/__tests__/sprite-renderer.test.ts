import { describe, it, expect, beforeEach } from 'vitest';
import type { PetRenderer, RendererCapabilities } from '../pet-renderer';
import { SpriteRenderer } from '../sprite-renderer';

describe('SpriteRenderer', () => {
  let renderer: PetRenderer;

  beforeEach(() => {
    const canvas = document.createElement('canvas');
    renderer = new SpriteRenderer(canvas);
  });

  it('implements PetRenderer interface — all methods exist', () => {
    expect(typeof renderer.type).toBe('string');
    expect(typeof renderer.load).toBe('function');
    expect(typeof renderer.setState).toBe('function');
    expect(typeof renderer.hitTest).toBe('function');
    expect(typeof renderer.update).toBe('function');
    expect(typeof renderer.getCanvas).toBe('function');
    expect(typeof renderer.capabilities).toBe('function');
    expect(typeof renderer.destroy).toBe('function');
  });

  it('type is "sprite"', () => {
    expect(renderer.type).toBe('sprite');
  });

  it('capabilities returns correct defaults for sprite renderer', () => {
    const caps: RendererCapabilities = renderer.capabilities();
    expect(caps.lipSync).toBe(false);
    expect(caps.expressionBlending).toBe(false);
    expect(caps.parameterDriving).toBe(false);
    expect(caps.physics).toBe(false);
    expect(caps.multiLayer).toBe(false);
  });

  it('getCanvas returns the canvas element', () => {
    const canvas = renderer.getCanvas();
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('hitTest returns false for transparent pixels', () => {
    const result = renderer.hitTest(0, 0);
    expect(result).toBe(false);
  });

  it('destroy does not throw', () => {
    expect(() => renderer.destroy()).not.toThrow();
  });

  it('setState does not throw for valid states', () => {
    expect(() => renderer.setState('idle')).not.toThrow();
    expect(() => renderer.setState('walk_left')).not.toThrow();
    expect(() => renderer.setState('happy')).not.toThrow();
  });

  it('update does not throw', () => {
    expect(() => renderer.update(16)).not.toThrow();
  });
});
