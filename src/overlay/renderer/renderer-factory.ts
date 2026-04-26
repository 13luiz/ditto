import type { RendererType, PetRenderer } from './pet-renderer';
import { SpriteRenderer } from './sprite-renderer';
import { SpineRenderer } from './spine-renderer';

export class RendererFactory {
  static create(type: RendererType, canvas: HTMLCanvasElement): PetRenderer {
    switch (type) {
      case 'sprite':
        return new SpriteRenderer(canvas);
      case 'spine':
        return new SpineRenderer(canvas);
      case 'live2d':
        throw new Error('Live2DRenderer not yet implemented');
      case 'lottie':
        throw new Error('LottieRenderer not yet implemented');
      case 'vrm':
        throw new Error('VRMRenderer not yet implemented');
      default:
        throw new Error(`Unsupported renderer type: ${type}`);
    }
  }
}
