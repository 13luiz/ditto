import { describe, it, expect } from 'vitest';
import { validateSkinManifest } from '../skin-manifest';
import type { SkinManifest } from '../pet-renderer';

describe('SkinManifest validation', () => {
  const validManifest: SkinManifest = {
    schema_version: '1.0',
    name: 'Test Skin',
    author: 'test_author',
    version: '1.0.0',
    renderer: 'sprite',
    size: { width: 64, height: 64 },
    state_map: { idle: 'idle' },
    sprite: {
      spritesheet: 'spritesheet.png',
      config: 'animations.json',
    },
  };

  it('accepts a valid sprite manifest', () => {
    const result = validateSkinManifest(validManifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects manifest missing name', () => {
    const { name, ...noName } = validManifest;
    const result = validateSkinManifest(noName as unknown as SkinManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('rejects manifest missing renderer', () => {
    const { renderer, ...noRenderer } = validManifest;
    const result = validateSkinManifest(noRenderer as unknown as SkinManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('renderer'))).toBe(true);
  });

  it('rejects manifest with invalid renderer type', () => {
    const result = validateSkinManifest({ ...validManifest, renderer: 'invalid' as SkinManifest['renderer'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('renderer'))).toBe(true);
  });

  it('rejects manifest missing version', () => {
    const { version, ...noVersion } = validManifest;
    const result = validateSkinManifest(noVersion as unknown as SkinManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  it('rejects manifest missing schema_version', () => {
    const { schema_version, ...noSchema } = validManifest;
    const result = validateSkinManifest(noSchema as unknown as SkinManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('schema_version'))).toBe(true);
  });

  it('rejects manifest missing size', () => {
    const { size, ...noSize } = validManifest;
    const result = validateSkinManifest(noSize as unknown as SkinManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('size'))).toBe(true);
  });

  it('rejects manifest with zero size', () => {
    const result = validateSkinManifest({ ...validManifest, size: { width: 0, height: 0 } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('size'))).toBe(true);
  });

  it('accepts all valid renderer types', () => {
    for (const renderer of ['sprite', 'spine', 'live2d', 'lottie', 'vrm'] as const) {
      const result = validateSkinManifest({ ...validManifest, renderer });
      expect(result.valid).toBe(true);
    }
  });

  it('accepts manifest without optional fields', () => {
    const minimal: SkinManifest = {
      schema_version: '1.0',
      name: 'Minimal',
      author: 'anon',
      version: '0.1.0',
      renderer: 'sprite',
      size: { width: 64, height: 64 },
      state_map: {},
    };
    const result = validateSkinManifest(minimal);
    expect(result.valid).toBe(true);
  });
});
