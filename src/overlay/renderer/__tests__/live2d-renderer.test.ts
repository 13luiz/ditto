import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Live2DRenderer } from '../live2d-renderer';
import type { SkinManifest } from '../pet-renderer';
import type { PetState } from '../../../types/pet-state';

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 400;
  return canvas;
}

function createMockManifest(): SkinManifest {
  return {
    schema_version: '2.0',
    name: 'Test Live2D Skin',
    author: 'Test',
    version: '1.0',
    renderer: 'live2d',
    size: { width: 300, height: 400 },
    state_map: {
      idle: 'Idle',
      happy: 'f00',
      sad: 'f02',
      talk: 'Tap',
    },
    live2d: {
      model: '/skins/sample-live2d/haru_greeter_t03.model3.json',
    },
  };
}

describe('Live2DRenderer', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = createMockCanvas();
  });

  it('has type "live2d"', () => {
    const renderer = new Live2DRenderer(canvas);
    expect(renderer.type).toBe('live2d');
  });

  it('implements PetRenderer interface', () => {
    const renderer = new Live2DRenderer(canvas);
    expect(typeof renderer.load).toBe('function');
    expect(typeof renderer.setState).toBe('function');
    expect(typeof renderer.hitTest).toBe('function');
    expect(typeof renderer.update).toBe('function');
    expect(typeof renderer.getCanvas).toBe('function');
    expect(typeof renderer.capabilities).toBe('function');
    expect(typeof renderer.destroy).toBe('function');
  });

  it('returns the canvas from getCanvas()', () => {
    const renderer = new Live2DRenderer(canvas);
    expect(renderer.getCanvas()).toBe(canvas);
  });

  it('reports lipSync and expression capabilities', () => {
    const renderer = new Live2DRenderer(canvas);
    const caps = renderer.capabilities();
    expect(caps.lipSync).toBe(true);
    expect(caps.expressionBlending).toBe(true);
  });

  it('read state_map from manifest on load', () => {
    const renderer = new Live2DRenderer(canvas);
    const manifest = createMockManifest();
    // load() will attempt to create PIXI app + model — mock internally
    renderer.loadStateMap(manifest);
    expect(renderer.getStateMap()).toEqual({
      idle: 'Idle',
      happy: 'f00',
      sad: 'f02',
      talk: 'Tap',
    });
  });

  it('defaults state_map to empty object if missing', () => {
    const renderer = new Live2DRenderer(canvas);
    const manifest = createMockManifest();
    // Create manifest without state_map
    const { state_map, ...manifestWithoutStateMap } = manifest;
    renderer.loadStateMap(manifestWithoutStateMap as SkinManifest);
    expect(renderer.getStateMap()).toEqual({});
  });

  it('maps PetState to motion group via state_map', () => {
    const renderer = new Live2DRenderer(canvas);
    const manifest = createMockManifest();
    renderer.loadStateMap(manifest);

    const mapped = renderer.mapState('idle');
    expect(mapped).toBe('Idle');

    const mapped2 = renderer.mapState('happy');
    expect(mapped2).toBe('f00');
  });

  it('returns the state name as-is if not in state_map', () => {
    const renderer = new Live2DRenderer(canvas);
    const manifest = createMockManifest();
    renderer.loadStateMap(manifest);

    const mapped = renderer.mapState('walk_left');
    expect(mapped).toBe('walk_left');
  });

  it('destroy cleans up without throwing', () => {
    const renderer = new Live2DRenderer(canvas);
    expect(() => renderer.destroy()).not.toThrow();
  });

  it('setMouthOpenness sets lip sync value', () => {
    const renderer = new Live2DRenderer(canvas);
    renderer.setMouthOpenness(0.5);
    expect(renderer.getMouthOpenness()).toBe(0.5);
  });

  it('setMouthOpenness clamps to [0, 1]', () => {
    const renderer = new Live2DRenderer(canvas);
    renderer.setMouthOpenness(1.5);
    expect(renderer.getMouthOpenness()).toBe(1.0);
    renderer.setMouthOpenness(-0.3);
    expect(renderer.getMouthOpenness()).toBe(0.0);
  });

  it('setExpression stores expression name', () => {
    const renderer = new Live2DRenderer(canvas);
    renderer.setExpression('f00');
    expect(renderer.getCurrentExpression()).toBe('f00');
  });

  it('update does not throw when no model loaded', () => {
    const renderer = new Live2DRenderer(canvas);
    expect(() => renderer.update(16)).not.toThrow();
  });
});
