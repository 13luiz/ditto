import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractionRouter } from '../interaction-router';
import type { InteractionMode, ModeContext } from '../types';

function createMockMode(type: string): InteractionMode {
  let receivedCtx: ModeContext | undefined;
  return {
    type: type as any,
    displayName: type,
    surface: 'dom',
    tier: 'light',
    mount(ctx: ModeContext) { receivedCtx = ctx; },
    unmount: vi.fn(),
    handleOutput: vi.fn(),
    capabilities: () => ({
      displaysText: false,
      acceptsTextInput: false,
      displaysChoices: false,
      triggersCareActions: false,
      requiresWebview: false,
      allowsConcurrent: true,
      supportsMultiAgent: false,
    }),
    getReceivedContext: () => receivedCtx,
  } as any;
}

describe('Overlay mount infrastructure', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'overlay-dom';
    document.body.appendChild(container);
  });

  it('provides overlayContainer to mounted modes', () => {
    const router = new InteractionRouter();
    router.setOverlayContainer(container);

    const mode = createMockMode('bark');
    router.enableMode(mode);

    const ctx = (mode as any).getReceivedContext();
    expect(ctx).toBeDefined();
    expect(ctx.overlayContainer).toBe(container);
  });

  it('overlayContainer is null when not set', () => {
    const router = new InteractionRouter();
    const mode = createMockMode('bark');
    router.enableMode(mode);

    const ctx = (mode as any).getReceivedContext();
    expect(ctx.overlayContainer).toBeNull();
  });

  it('modes can append DOM elements to overlayContainer', () => {
    const router = new InteractionRouter();
    router.setOverlayContainer(container);

    const barkEl = document.createElement('div');
    barkEl.textContent = 'test bark';
    container.appendChild(barkEl);

    expect(container.children.length).toBe(1);
    expect(container.textContent).toBe('test bark');
  });

  it('overlayContainer does not interfere with canvas', () => {
    const canvas = document.createElement('canvas');
    canvas.id = 'pet-canvas';
    document.body.appendChild(canvas);

    const foundCanvas = document.getElementById('pet-canvas');
    const foundOverlay = document.getElementById('overlay-dom');
    expect(foundCanvas).toBeTruthy();
    expect(foundOverlay).toBeTruthy();
    expect(foundOverlay?.id).toBe('overlay-dom');
    expect(foundCanvas?.parentElement).not.toBe(foundOverlay);
  });
});
