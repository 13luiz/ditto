import type { RendererType, PetRenderer } from './pet-renderer';
import { SpriteRenderer } from './sprite-renderer';
import { SpineRenderer } from './spine-renderer';
import { Live2DRenderer } from './live2d-renderer';

export class RendererFactory {
  static create(type: RendererType, canvas: HTMLCanvasElement): PetRenderer {
    switch (type) {
      case 'sprite':
        return new SpriteRenderer(canvas);
      case 'spine':
        return new SpineRenderer(canvas);
      case 'live2d':
        return new Live2DRenderer(canvas);
      case 'lottie':
        throw new Error('LottieRenderer not yet implemented');
      case 'vrm':
        throw new Error('VRMRenderer not yet implemented');
      default:
        throw new Error(`Unsupported renderer type: ${type}`);
    }
  }
}
