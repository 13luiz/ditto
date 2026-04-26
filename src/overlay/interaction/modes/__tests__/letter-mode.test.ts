import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LetterMode } from '../letter-mode';
import type { ModeContext, InteractionEvent } from '../../types';

function createMockContext(config?: Record<string, unknown>): ModeContext {
  return {
    canvas: null,
    overlayContainer: document.createElement('div'),
    getPetPosition: () => ({ x: 100, y: 200, width: 64, height: 64 }),
    getPetState: () => 'idle',
    dispatch: vi.fn(),
    config,
  };
}

describe('LetterMode', () => {
  let mode: LetterMode;
  let ctx: ModeContext;

  beforeEach(() => {
    mode = new LetterMode();
    ctx = createMockContext({ bondLevel: 7 });
  });

  afterEach(() => {
    mode.unmount();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('letter');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('review');
  });

  it('declares capabilities', () => {
    const caps = mode.capabilities();
    expect(caps.displaysText).toBe(true);
    expect(caps.acceptsTextInput).toBe(true);
    expect(caps.requiresWebview).toBe(true);
    expect(caps.allowsConcurrent).toBe(false);
  });

  it('creates envelope notification on letter_received output', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'letter_received', letterId: 'letter-1' });

    const envelope = ctx.overlayContainer!.querySelector('.letter-envelope');
    expect(envelope).toBeTruthy();
  });

  it('dispatches letter_send event on reply', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'letter_received', letterId: 'letter-1' });

    mode.sendReply('letter-1', 'I miss you too!');

    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'letter_send',
      content: 'I miss you too!',
      attachment: undefined,
    });
  });

  it('refuses if bond level below 6', () => {
    const lowBondCtx = createMockContext({ bondLevel: 4 });
    mode.mount(lowBondCtx);
    mode.handleOutput({ kind: 'letter_received', letterId: 'letter-2' });

    const envelope = lowBondCtx.overlayContainer!.querySelector('.letter-envelope');
    // Should show locked message, not actual letter
    expect(envelope).toBeTruthy();
    expect(envelope!.textContent).toContain('Bond Lv.6');
  });

  it('tracks pending letter count', () => {
    mode.mount(ctx);
    expect(mode.getPendingCount()).toBe(0);

    mode.handleOutput({ kind: 'letter_received', letterId: 'letter-1' });
    expect(mode.getPendingCount()).toBe(1);

    mode.handleOutput({ kind: 'letter_received', letterId: 'letter-2' });
    expect(mode.getPendingCount()).toBe(2);
  });

  it('removes DOM elements on unmount', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'letter_received', letterId: 'letter-1' });

    mode.unmount();

    const envelope = ctx.overlayContainer!.querySelector('.letter-envelope');
    expect(envelope).toBeNull();
  });

  it('ignores non-letter outputs', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello!', streaming: false });
    mode.handleOutput({ kind: 'agent_emotion', emotion: 'happy' });

    expect(mode.getPendingCount()).toBe(0);
  });

  it('clears pending after mark read', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'letter_received', letterId: 'letter-1' });
    expect(mode.getPendingCount()).toBe(1);

    mode.markRead('letter-1');
    expect(mode.getPendingCount()).toBe(0);
  });
});
