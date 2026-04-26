import { describe, it, expect } from 'vitest';
import type { PetRenderer, RendererCapabilities, RendererType } from '../pet-renderer';
import { isLipSyncable, isExpressible, isParameterDrivable } from '../pet-renderer';

function createMockRenderer(caps: Partial<RendererCapabilities> = {}): PetRenderer {
  return {
    type: 'sprite' as RendererType,
    load: async () => {},
    setState: () => {},
    hitTest: () => false,
    update: () => {},
    getCanvas: () => document.createElement('canvas'),
    capabilities: () => ({
      lipSync: false,
      expressionBlending: false,
      parameterDriving: false,
      physics: false,
      multiLayer: false,
      ...caps,
    }),
    destroy: () => {},
  };
}

describe('PetRenderer interface', () => {
  it('has all required methods', () => {
    const renderer = createMockRenderer();
    expect(typeof renderer.type).toBe('string');
    expect(typeof renderer.load).toBe('function');
    expect(typeof renderer.setState).toBe('function');
    expect(typeof renderer.hitTest).toBe('function');
    expect(typeof renderer.update).toBe('function');
    expect(typeof renderer.getCanvas).toBe('function');
    expect(typeof renderer.capabilities).toBe('function');
    expect(typeof renderer.destroy).toBe('function');
  });

  it('capabilities returns RendererCapabilities with all fields', () => {
    const renderer = createMockRenderer();
    const caps = renderer.capabilities();
    expect(typeof caps.lipSync).toBe('boolean');
    expect(typeof caps.expressionBlending).toBe('boolean');
    expect(typeof caps.parameterDriving).toBe('boolean');
    expect(typeof caps.physics).toBe('boolean');
    expect(typeof caps.multiLayer).toBe('boolean');
  });

  it('RendererType accepts valid values', () => {
    const types: RendererType[] = ['sprite', 'spine', 'live2d', 'lottie', 'vrm'];
    expect(types).toHaveLength(5);
  });
});

describe('Type guards', () => {
  it('isLipSyncable returns true when lipSync capability is true', () => {
    const renderer = createMockRenderer({ lipSync: true });
    expect(isLipSyncable(renderer)).toBe(true);
  });

  it('isLipSyncable returns false when lipSync capability is false', () => {
    const renderer = createMockRenderer({ lipSync: false });
    expect(isLipSyncable(renderer)).toBe(false);
  });

  it('isExpressible returns true when expressionBlending is true', () => {
    const renderer = createMockRenderer({ expressionBlending: true });
    expect(isExpressible(renderer)).toBe(true);
  });

  it('isExpressible returns false when expressionBlending is false', () => {
    const renderer = createMockRenderer({ expressionBlending: false });
    expect(isExpressible(renderer)).toBe(false);
  });

  it('isParameterDrivable returns true when parameterDriving is true', () => {
    const renderer = createMockRenderer({ parameterDriving: true });
    expect(isParameterDrivable(renderer)).toBe(true);
  });

  it('isParameterDrivable returns false when parameterDriving is false', () => {
    const renderer = createMockRenderer({ parameterDriving: false });
    expect(isParameterDrivable(renderer)).toBe(false);
  });
});
