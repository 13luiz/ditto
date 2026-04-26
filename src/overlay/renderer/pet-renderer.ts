import type { PetState } from '../../types/pet-state';

export type RendererType = 'sprite' | 'spine' | 'live2d' | 'lottie' | 'vrm';

export interface RendererCapabilities {
  lipSync: boolean;
  expressionBlending: boolean;
  parameterDriving: boolean;
  physics: boolean;
  multiLayer: boolean;
}

export interface PetRenderer {
  readonly type: RendererType;
  load(manifest: SkinManifest): Promise<void>;
  setState(state: PetState): void;
  hitTest(x: number, y: number): boolean;
  update(dt: number): void;
  getCanvas(): HTMLCanvasElement;
  capabilities(): RendererCapabilities;
  destroy(): void;
}

export interface LipSyncable {
  setMouthOpenness(value: number): void;
}

export interface Expressible {
  setExpression(name: string, weight?: number): void;
}

export interface ParameterDrivable {
  setParameter(name: string, value: number): void;
  getParameter(name: string): number;
}

export interface SkinManifest {
  schema_version: string;
  name: string;
  author: string;
  version: string;
  renderer: RendererType;
  preview?: string;
  preview_animation?: string;
  size: { width: number; height: number };
  source?: 'local' | 'workshop' | 'url';
  min_bond_level?: number;
  license?: string;
  tags?: string[];
  state_map: Record<string, string>;
  sprite?: {
    spritesheet: string;
    config: string;
    layers?: string[];
  };
  spine?: {
    skeleton: string;
    atlas: string;
  };
  live2d?: {
    model: string;
  };
  touch_zones?: Record<string, { x: number; y: number; w: number; h: number }>;
}

export function isLipSyncable(r: PetRenderer): r is PetRenderer & LipSyncable {
  return r.capabilities().lipSync;
}

export function isExpressible(r: PetRenderer): r is PetRenderer & Expressible {
  return r.capabilities().expressionBlending;
}

export function isParameterDrivable(r: PetRenderer): r is PetRenderer & ParameterDrivable {
  return r.capabilities().parameterDriving;
}
