import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractionRouter } from '../interaction-router';
import { DialogPanelMode } from '../modes/dialog-panel-mode';
import type { InteractionMode, InteractionEvent } from '../types';

describe('DialogPanelMode integration with InteractionRouter', () => {
  let router: InteractionRouter;

  beforeEach(() => {
    router = new InteractionRouter();
  });

  it('double_click gesture dispatches to DialogPanelMode', () => {
    const mode = new DialogPanelMode();
    router.enableMode(mode);
    router.setGestureMap({ double_click: 'dialog_panel' });

    const events: InteractionEvent[] = [];
    router.onEvent((e) => events.push(e));

    const handled = router.handleGesture('double_click');

    expect(handled).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'gesture', type: 'double_click' });
  });

  it('DialogPanelMode is mutually exclusive with speech_bubble', () => {
    const dialogMode = new DialogPanelMode();
    router.enableMode(dialogMode);

    const speechMode: InteractionMode = {
      type: 'speech_bubble',
      displayName: 'Speech',
      surface: 'dom',
      tier: 'active',
      mount: vi.fn(),
      unmount: vi.fn(),
      handleOutput: vi.fn(),
      capabilities: () => ({
        displaysText: true,
        acceptsTextInput: false,
        displaysChoices: false,
        triggersCareActions: false,
        requiresWebview: false,
        allowsConcurrent: false,
        supportsMultiAgent: false,
      }),
    };

    expect(() => router.enableMode(speechMode)).toThrow('mutually exclusive');
  });
});
