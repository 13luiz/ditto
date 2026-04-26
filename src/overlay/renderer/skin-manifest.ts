import type { SkinManifest, RendererType } from './pet-renderer';

const VALID_RENDERERS: RendererType[] = ['sprite', 'spine', 'live2d', 'lottie', 'vrm'];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSkinManifest(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['manifest must be an object'] };
  }

  const m = data as Record<string, unknown>;

  if (typeof m.schema_version !== 'string' || !m.schema_version) {
    errors.push('schema_version is required and must be a non-empty string');
  }

  if (typeof m.name !== 'string' || !m.name) {
    errors.push('name is required and must be a non-empty string');
  }

  if (typeof m.version !== 'string' || !m.version) {
    errors.push('version is required and must be a non-empty string');
  }

  if (typeof m.renderer !== 'string' || !VALID_RENDERERS.includes(m.renderer as RendererType)) {
    errors.push(`renderer is required and must be one of: ${VALID_RENDERERS.join(', ')}`);
  }

  if (!m.size || typeof m.size !== 'object') {
    errors.push('size is required and must be an object with width and height');
  } else {
    const s = m.size as Record<string, unknown>;
    if (typeof s.width !== 'number' || typeof s.height !== 'number' || s.width <= 0 || s.height <= 0) {
      errors.push('size.width and size.height must be positive numbers');
    }
  }

  return { valid: errors.length === 0, errors };
}
