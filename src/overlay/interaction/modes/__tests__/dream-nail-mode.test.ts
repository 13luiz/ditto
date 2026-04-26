import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DreamNailMode } from '../dream-nail-mode';
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

describe('DreamNailMode', () => {
  let mode: DreamNailMode;
  let ctx: ModeContext;

  beforeEach(() => {
    vi.useFakeTimers();
    mode = new DreamNailMode();
    ctx = createMockContext({ bondLevel: 7 });
  });

  afterEach(() => {
    mode.unmount();
    vi.useRealTimers();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('dream_nail');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('active');
  });

  it('declares capabilities', () => {
    const caps = mode.capabilities();
    expect(caps.displaysText).toBe(true);
    expect(caps.acceptsTextInput).toBe(false);
    expect(caps.requiresWebview).toBe(false);
    expect(caps.allowsConcurrent).toBe(true);
  });

  it('responds to agent_inner_thought output', () => {
    mode.mount(ctx);
    mode.handleOutput({
      kind: 'agent_inner_thought',
      text: '...I wonder what they are thinking about...',
    });

    const overlay = ctx.overlayContainer!.querySelector('.dream-nail-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay!.textContent).toContain('wonder');
  });

  it('displays thought in italic translucent overlay', () => {
    mode.mount(ctx);
    mode.handleOutput({
      kind: 'agent_inner_thought',
      text: '...so quiet today...',
    });

    const overlay = ctx.overlayContainer!.querySelector('.dream-nail-overlay') as HTMLDivElement;
    expect(overlay).toBeTruthy();
    expect(overlay.style.fontStyle).toBe('italic');
    expect(parseFloat(overlay.style.opacity)).toBeLessThan(1);
  });

  it('positions dream overlay above pet', () => {
    mode.mount(ctx);
    mode.handleOutput({
      kind: 'agent_inner_thought',
      text: '...hello...',
    });

    const overlay = ctx.overlayContainer!.querySelector('.dream-nail-overlay') as HTMLDivElement;
    expect(overlay).toBeTruthy();
    expect(overlay.style.position).toBe('absolute');
  });

  it('auto-fades after display period', () => {
    mode.mount(ctx);
    mode.handleOutput({
      kind: 'agent_inner_thought',
      text: '...temporary thought...',
    });

    const overlay = ctx.overlayContainer!.querySelector('.dream-nail-overlay') as HTMLDivElement;
    expect(overlay).toBeTruthy();

    // Advance past display + fade (4000ms + 1000ms)
    vi.advanceTimersByTime(5500);

    expect(overlay.style.opacity).toBe('0');
  });

  it('ignores non-inner-thought outputs', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello!', streaming: false });
    mode.handleOutput({ kind: 'agent_emotion', emotion: 'happy' });
    mode.handleOutput({ kind: 'care_state', hunger: 50, happiness: 80, energy: 60, social: 40, mood: 60, moodLabel: 'happy' });

    const overlay = ctx.overlayContainer!.querySelector('.dream-nail-overlay');
    expect(overlay).toBeNull();
  });

  it('emits dream_nail_activate event via dispatch', () => {
    mode.mount(ctx);
    mode.handleOutput({
      kind: 'agent_inner_thought',
      text: '...peeking...',
    });

    expect(ctx.dispatch).toHaveBeenCalledWith({ kind: 'dream_nail_activate' });
  });

  it('refuses if bond level below 5', () => {
    const lowBondCtx = createMockContext({ bondLevel: 3 });
    mode.mount(lowBondCtx);
    mode.handleOutput({
      kind: 'agent_inner_thought',
      text: '...should not appear...',
    });

    // Should show locked message instead of thought
    const overlay = lowBondCtx.overlayContainer!.querySelector('.dream-nail-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay!.textContent).toContain('Bond Lv.5');
  });

  it('does not emit dream_nail_activate when locked', () => {
    const lowBondCtx = createMockContext({ bondLevel: 3 });
    mode.mount(lowBondCtx);
    mode.handleOutput({
      kind: 'agent_inner_thought',
      text: '...should not trigger...',
    });

    expect(lowBondCtx.dispatch).not.toHaveBeenCalledWith({ kind: 'dream_nail_activate' });
  });

  it('rate limits to 3 uses per day', () => {
    mode.mount(ctx);

    for (let i = 0; i < 4; i++) {
      mode.handleOutput({
        kind: 'agent_inner_thought',
        text: `...thought ${i}...`,
      });
    }

    // First 3 should dispatch, 4th should be rate-limited
    const dispatchCalls = (ctx.dispatch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: unknown[]) => (call[0] as InteractionEvent).kind === 'dream_nail_activate',
    );
    expect(dispatchCalls.length).toBe(3);
  });

  it('removes DOM elements on unmount', () => {
    mode.mount(ctx);
    mode.handleOutput({
      kind: 'agent_inner_thought',
      text: '...cleanup test...',
    });

    mode.unmount();

    const overlay = ctx.overlayContainer!.querySelector('.dream-nail-overlay');
    expect(overlay).toBeNull();
  });

  it('tracks daily usage count', () => {
    mode.mount(ctx);
    expect(mode.getDailyUseCount()).toBe(0);

    mode.handleOutput({ kind: 'agent_inner_thought', text: '...one...' });
    expect(mode.getDailyUseCount()).toBe(1);

    mode.handleOutput({ kind: 'agent_inner_thought', text: '...two...' });
    expect(mode.getDailyUseCount()).toBe(2);
  });
});
