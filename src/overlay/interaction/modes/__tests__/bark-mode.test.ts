import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BarkMode } from '../bark-mode';
import type { ModeContext, InteractionEvent } from '../../types';

function createMockContext(): ModeContext {
  return {
    canvas: null,
    overlayContainer: document.createElement('div'),
    getPetPosition: () => ({ x: 100, y: 200, width: 64, height: 64 }),
    getPetState: () => 'idle',
    dispatch: vi.fn(),
  };
}

describe('BarkMode', () => {
  let mode: BarkMode;
  let ctx: ModeContext;

  beforeEach(() => {
    vi.useFakeTimers();
    mode = new BarkMode();
    ctx = createMockContext();
  });

  afterEach(() => {
    mode.unmount();
    vi.useRealTimers();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('bark');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('passive');
  });

  it('responds to agent_text output', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello!', streaming: false });

    expect(mode.queueLength()).toBe(1);
  });

  it('responds to care_need_critical output', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_need_critical', need: 'hunger', value: 15 });

    expect(mode.queueLength()).toBe(1);
  });

  it('ignores irrelevant output types', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_emotion', emotion: 'happy' });

    expect(mode.queueLength()).toBe(0);
  });

  it('enqueues up to 3 barks, drops overflow', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'One', streaming: false });
    mode.handleOutput({ kind: 'agent_text', text: 'Two', streaming: false });
    mode.handleOutput({ kind: 'agent_text', text: 'Three', streaming: false });
    mode.handleOutput({ kind: 'agent_text', text: 'Four', streaming: false });

    expect(mode.queueLength()).toBe(3);
  });

  it('creates a DOM element in overlayContainer on mount', () => {
    mode.mount(ctx);

    expect(ctx.overlayContainer!.querySelector('.bark-container')).toBeTruthy();
  });

  it('removes DOM element from overlayContainer on unmount', () => {
    mode.mount(ctx);
    mode.unmount();

    expect(ctx.overlayContainer!.querySelector('.bark-container')).toBeNull();
  });

  it('positions bark above pet', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello!', streaming: false });

    const container = ctx.overlayContainer!.querySelector('.bark-container') as HTMLDivElement;
    expect(container).toBeTruthy();
    // Should be positioned above pet (y=200, height=64 → bark at ~200 - offset)
    const bottom = parseInt(container.style.bottom, 10);
    expect(bottom).toBeGreaterThan(0);
  });

  it('auto-fades after hold period', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Fade test', streaming: false });

    const item = ctx.overlayContainer!.querySelector('.bark-item') as HTMLDivElement;
    expect(item).toBeTruthy();
    expect(item.style.opacity).not.toBe('0');

    // Advance past hold (2500ms) + fade (500ms)
    vi.advanceTimersByTime(3000);

    expect(item.style.opacity).toBe('0');
  });

  it('removes element after fade completes', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Bye', streaming: false });

    vi.advanceTimersByTime(3000);

    // After fade-out, the bark element should be removed
    const items = ctx.overlayContainer!.querySelectorAll('.bark-item');
    expect(items.length).toBe(0);
  });
});
