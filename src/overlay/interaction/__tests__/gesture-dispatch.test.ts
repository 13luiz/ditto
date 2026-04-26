import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractionRouter } from '../interaction-router';
import type { InteractionMode, InteractionEvent } from '../types';

function createMockMode(type: string): InteractionMode {
  return {
    type: type as any,
    displayName: type,
    surface: 'dom',
    tier: 'light',
    mount: vi.fn(),
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
  } as any;
}

describe('Gesture dispatch', () => {
  let router: InteractionRouter;

  beforeEach(() => {
    router = new InteractionRouter();
  });

  it('dispatches gesture event when gesture maps to active mode', () => {
    const mode = createMockMode('dialog_panel');
    router.enableMode(mode);
    router.setGestureMap({ double_click: 'dialog_panel' });

    const events: InteractionEvent[] = [];
    router.onEvent((e) => events.push(e));

    const handled = router.handleGesture('double_click');

    expect(handled).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'gesture', type: 'double_click' });
  });

  it('returns false and does not dispatch when gesture is not mapped', () => {
    const events: InteractionEvent[] = [];
    router.onEvent((e) => events.push(e));

    const handled = router.handleGesture('double_click');

    expect(handled).toBe(false);
    expect(events).toHaveLength(0);
  });

  it('returns false when target mode is not active', () => {
    router.setGestureMap({ double_click: 'dialog_panel' });

    const events: InteractionEvent[] = [];
    router.onEvent((e) => events.push(e));

    const handled = router.handleGesture('double_click');

    expect(handled).toBe(false);
    expect(events).toHaveLength(0);
  });

  it('routes context_menu to radial_menu mode', () => {
    const mode = createMockMode('radial_menu');
    router.enableMode(mode);
    router.setGestureMap({ context_menu: 'radial_menu' });

    const events: InteractionEvent[] = [];
    router.onEvent((e) => events.push(e));

    const handled = router.handleGesture('context_menu');

    expect(handled).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'gesture', type: 'context_menu' });
  });
});
