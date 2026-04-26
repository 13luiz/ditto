import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThoughtBubbleMode } from '../thought-bubble-mode';
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

describe('ThoughtBubbleMode', () => {
  let mode: ThoughtBubbleMode;
  let ctx: ModeContext;

  beforeEach(() => {
    mode = new ThoughtBubbleMode();
    ctx = createMockContext();
  });

  afterEach(() => {
    mode.unmount();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('thought_bubble');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('passive');
  });

  it('creates DOM element on mount', () => {
    mode.mount(ctx);
    expect(ctx.overlayContainer!.querySelector('.thought-bubble')).toBeTruthy();
  });

  it('removes DOM element on unmount', () => {
    mode.mount(ctx);
    mode.unmount();
    expect(ctx.overlayContainer!.querySelector('.thought-bubble')).toBeNull();
  });

  it('shows hunger icon on care_need_critical', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_need_critical', need: 'hunger', value: 15 });

    const bubble = ctx.overlayContainer!.querySelector('.thought-bubble') as HTMLDivElement;
    expect(bubble.textContent).toContain('🍖');
  });

  it('shows happiness icon on care_need_critical', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_need_critical', need: 'happiness', value: 10 });

    const bubble = ctx.overlayContainer!.querySelector('.thought-bubble') as HTMLDivElement;
    expect(bubble.textContent).toContain('😢');
  });

  it('shows energy icon on care_need_critical', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_need_critical', need: 'energy', value: 12 });

    const bubble = ctx.overlayContainer!.querySelector('.thought-bubble') as HTMLDivElement;
    expect(bubble.textContent).toContain('💤');
  });

  it('shows social icon on care_need_critical', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_need_critical', need: 'social', value: 8 });

    const bubble = ctx.overlayContainer!.querySelector('.thought-bubble') as HTMLDivElement;
    expect(bubble.textContent).toContain('💬');
  });

  it('adds critical-pulse class for critical needs', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_need_critical', need: 'hunger', value: 15 });

    const bubble = ctx.overlayContainer!.querySelector('.thought-bubble') as HTMLDivElement;
    expect(bubble.classList.contains('critical')).toBe(true);
  });

  it('does not add critical class for non-critical care_state', () => {
    mode.mount(ctx);
    mode.handleOutput({
      kind: 'care_state',
      hunger: 80, happiness: 70, energy: 60, social: 50,
      mood: 65, moodLabel: 'content',
    });

    const bubble = ctx.overlayContainer!.querySelector('.thought-bubble') as HTMLDivElement;
    if (bubble) {
      expect(bubble.classList.contains('critical')).toBe(false);
    }
  });

  it('ignores irrelevant output types', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_emotion', emotion: 'happy' });

    const bubble = ctx.overlayContainer!.querySelector('.thought-bubble');
    // Should either not exist or have no icon content
    if (bubble) {
      expect(bubble.textContent?.trim()).toBe('');
    }
  });

  it('shows multiple icons when multiple needs are critical', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_need_critical', need: 'hunger', value: 15 });
    mode.handleOutput({ kind: 'care_need_critical', need: 'energy', value: 10 });

    const bubble = ctx.overlayContainer!.querySelector('.thought-bubble') as HTMLDivElement;
    expect(bubble.textContent).toContain('🍖');
    expect(bubble.textContent).toContain('💤');
  });
});
