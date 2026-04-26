import type {
  PetRenderer,
  RendererCapabilities,
  SkinManifest,
  LipSyncable,
  Expressible,
} from './pet-renderer';
import type { PetState } from '../../types/pet-state';

export class Live2DRenderer implements PetRenderer, LipSyncable, Expressible {
  readonly type = 'live2d' as const;

  private canvas: HTMLCanvasElement;
  private stateMap: Record<string, string> = {};
  private mouthOpenness = 0;
  private currentExpression: string | null = null;
  private model: any = null;
  private app: any = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async load(manifest: SkinManifest): Promise<void> {
    this.stateMap = manifest.state_map ?? {};

    const live2dConf = manifest.live2d;
    if (!live2dConf) throw new Error('Live2D skin manifest missing live2d config');

    // Dynamic imports to avoid bundling issues in test environments
    const PIXI = await import('pixi.js');
    const { Live2DModel } = await import('pixi-live2d-display');

    // Register PIXI globally for pixi-live2d-display
    (window as any).PIXI = PIXI;

    this.app = new PIXI.Application({
      view: this.canvas,
      transparent: true,
      autoStart: true,
      resizeTo: undefined,
      backgroundAlpha: 0,
      width: manifest.size.width,
      height: manifest.size.height,
    });

    this.model = await Live2DModel.from(live2dConf.model, { autoInteract: false });
    this.model.anchor.set(0.5, 0.5);
    this.model.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

    const scale = Math.min(
      this.app.screen.width / this.model.width * 0.9,
      this.app.screen.height / this.model.height * 0.9,
    );
    this.model.scale.set(scale);
    this.app.stage.addChild(this.model);
  }

  setState(state: PetState): void {
    if (!this.model) return;
    const motionGroup = this.mapState(state);
    try {
      this.model.motion(motionGroup);
    } catch {
      // Motion group may not exist; fall back silently
    }
  }

  hitTest(x: number, y: number): boolean {
    if (!this.model) return false;
    try {
      return this.model.hitTest(x, y, 'Body') || this.model.hitTest(x, y, 'Head');
    } catch {
      return false;
    }
  }

  update(_dt: number): void {
    // PIXI.Application handles its own ticker
    // Apply lip sync parameter if model supports it
    if (this.model && this.mouthOpenness > 0) {
      try {
        this.model.internalModel.coreModel.setParameterValueById(
          'ParamMouthOpenY',
          this.mouthOpenness,
        );
      } catch {
        // Parameter may not exist
      }
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  capabilities(): RendererCapabilities {
    return {
      lipSync: true,
      expressionBlending: true,
      parameterDriving: true,
      physics: true,
      multiLayer: false,
    };
  }

  destroy(): void {
    this.model = null;
    if (this.app) {
      try {
        this.app.destroy(true);
      } catch {
        // May already be destroyed
      }
      this.app = null;
    }
  }

  // LipSyncable
  setMouthOpenness(value: number): void {
    this.mouthOpenness = Math.max(0, Math.min(1, value));
  }

  getMouthOpenness(): number {
    return this.mouthOpenness;
  }

  // Expressible
  setExpression(name: string, _weight?: number): void {
    this.currentExpression = name;
    if (!this.model) return;
    try {
      this.model.expression(name);
    } catch {
      // Expression may not exist
    }
  }

  getCurrentExpression(): string | null {
    return this.currentExpression;
  }

  // Test helpers
  loadStateMap(manifest: SkinManifest): void {
    this.stateMap = manifest.state_map ?? {};
  }

  getStateMap(): Record<string, string> {
    return { ...this.stateMap };
  }

  mapState(state: string): string {
    return this.stateMap[state] ?? state;
  }
}
