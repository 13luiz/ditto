import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DialogPanelMode } from '../dialog-panel-mode';
import type { ModeContext } from '../../types';

function createMockContext(): ModeContext {
  return {
    canvas: null,
    overlayContainer: document.createElement('div'),
    getPetPosition: () => ({ x: 100, y: 200, width: 64, height: 64 }),
    getPetState: () => 'idle',
    dispatch: vi.fn(),
  };
}

describe('DialogPanelMode', () => {
  let mode: DialogPanelMode;
  let ctx: ModeContext;

  beforeEach(() => {
    mode = new DialogPanelMode();
    ctx = createMockContext();
  });

  afterEach(() => {
    mode.unmount();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('dialog_panel');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('active');
  });

  it('mounts and unmounts without error', () => {
    expect(() => mode.mount(ctx)).not.toThrow();
    expect(() => mode.unmount()).not.toThrow();
  });

  it('has correct capabilities', () => {
    const caps = mode.capabilities();
    expect(caps.displaysText).toBe(true);
    expect(caps.acceptsTextInput).toBe(true);
    expect(caps.requiresWebview).toBe(true);
    expect(caps.allowsConcurrent).toBe(false);
  });

  it('provides openChat method that returns /chat route', () => {
    mode.mount(ctx);
    expect(mode.getTargetRoute()).toBe('/chat');
  });

  it('handleOutput is a no-op (delegates to Pet Manager)', () => {
    mode.mount(ctx);
    expect(() => mode.handleOutput({ kind: 'agent_text', text: 'hi', streaming: false })).not.toThrow();
  });
});
