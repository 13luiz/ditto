import type { PetRenderer, RendererCapabilities, SkinManifest } from './pet-renderer';
import type { PetState } from '../../types/pet-state';

export class SpineRenderer implements PetRenderer {
  readonly type = 'spine' as const;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private skeleton: any = null;
  private animState: any = null;
  private renderer: any = null;
  private stateMap: Record<string, string> = {};
  private _width = 64;
  private _height = 64;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
  }

  async load(manifest: SkinManifest): Promise<void> {
    const { AssetManager, AtlasAttachmentLoader, SkeletonJson, Skeleton, AnimationState, AnimationStateData, SkeletonRenderer } =
      await import('@esotericsoftware/spine-canvas');

    this.stateMap = manifest.state_map ?? {};
    const spineConf = manifest.spine;
    if (!spineConf) throw new Error('Spine skin manifest missing spine config');

    this._width = manifest.size?.width ?? 64;
    this._height = manifest.size?.height ?? 64;
    this.canvas.width = this._width;
    this.canvas.height = this._height;

    const dir = spineConf.skeleton.substring(0, spineConf.skeleton.lastIndexOf('/') + 1);
    const skelFile = spineConf.skeleton.substring(dir.length);
    const atlasFile = spineConf.atlas.substring(dir.length);

    const assetManager = new AssetManager(dir || './');
    assetManager.loadText(skelFile);
    assetManager.loadTextureAtlas(atlasFile);
    await assetManager.loadAll();

    const atlas = assetManager.get(atlasFile);
    const attachmentLoader = new AtlasAttachmentLoader(atlas);
    const skeletonJson = new SkeletonJson(attachmentLoader);
    const skeletonData = skeletonJson.readSkeletonData(assetManager.get(skelFile));

    this.skeleton = new Skeleton(skeletonData);
    this.skeleton.updateWorldTransform();

    const animStateData = new AnimationStateData(skeletonData);
    this.animState = new AnimationState(animStateData);

    this.renderer = new SkeletonRenderer(this.ctx);

    const defaultAnim = manifest.preview_animation ?? 'idle';
    const hasAnim = skeletonData.animations.some((a: any) => a.name === defaultAnim);
    if (hasAnim) {
      this.animState.setAnimation(0, defaultAnim, true);
    }
  }

  setState(state: PetState): void {
    if (!this.animState) return;
    const animName = this.stateMap[state] ?? state;
    this.animState.setAnimation(0, animName, true);
  }

  hitTest(x: number, y: number): boolean {
    if (!this.skeleton) return false;
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) return false;
    const offset = { x: 0, y: 0 };
    const size = { x: 0, y: 0 };
    try {
      this.skeleton.getBounds(offset, size, []);
      return (
        x >= offset.x &&
        x <= offset.x + size.x &&
        y >= offset.y &&
        y <= offset.y + size.y
      );
    } catch {
      return true;
    }
  }

  update(dt: number): void {
    if (!this.skeleton || !this.animState || !this.renderer) return;
    this.animState.update(dt / 1000);
    this.animState.apply(this.skeleton);
    this.skeleton.updateWorldTransform();

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderer.draw(this.skeleton);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  capabilities(): RendererCapabilities {
    return {
      lipSync: false,
      expressionBlending: true,
      parameterDriving: true,
      physics: true,
      multiLayer: false,
    };
  }

  destroy(): void {
    this.skeleton = null;
    this.animState = null;
    this.renderer = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
