import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechBubbleMode } from '../speech-bubble-mode';
import type { ModeContext, InteractionEvent } from '../../types';

function createMockContext(overrides?: Partial<ModeContext>): ModeContext {
  return {
    canvas: null,
    overlayContainer: document.createElement('div'),
    getPetPosition: () => ({ x: 100, y: 300, width: 64, height: 64 }),
    getPetState: () => 'idle',
    dispatch: vi.fn(),
    ...overrides,
  };
}

describe('SpeechBubbleMode', () => {
  let mode: SpeechBubbleMode;
  let ctx: ModeContext;
  let dispatched: InteractionEvent[];

  beforeEach(() => {
    mode = new SpeechBubbleMode();
    dispatched = [];
    ctx = createMockContext({
      dispatch: (e) => dispatched.push(e),
    });
  });

  afterEach(() => {
    mode.unmount();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('speech_bubble');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('active');
  });

  it('creates DOM element on mount', () => {
    mode.mount(ctx);
    expect(ctx.overlayContainer!.querySelector('.speech-bubble')).toBeTruthy();
  });

  it('removes DOM element on unmount', () => {
    mode.mount(ctx);
    mode.unmount();
    expect(ctx.overlayContainer!.querySelector('.speech-bubble')).toBeNull();
  });

  it('shows text on agent_text output', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello there!', streaming: false });

    const bubble = ctx.overlayContainer!.querySelector('.speech-bubble-text') as HTMLDivElement;
    expect(bubble).toBeTruthy();
    expect(bubble.textContent).toContain('Hello there!');
  });

  it('appends streaming tokens', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello', streaming: true });
    mode.handleOutput({ kind: 'agent_text', text: ' world', streaming: true });

    const bubble = ctx.overlayContainer!.querySelector('.speech-bubble-text') as HTMLDivElement;
    expect(bubble.textContent).toContain('Hello');
    expect(bubble.textContent).toContain('world');
  });

  it('shows quick-reply chips', () => {
    mode.mount(ctx);
    mode.setQuickReplies(['Yes', 'No', 'Maybe']);
    mode.handleOutput({ kind: 'agent_text', text: 'Question?', streaming: false });

    const chips = ctx.overlayContainer!.querySelectorAll('.speech-chip');
    expect(chips.length).toBe(3);
    expect(chips[0].textContent).toBe('Yes');
  });

  it('dispatches chat_message on chip click', () => {
    mode.mount(ctx);
    mode.setQuickReplies(['Yes']);
    mode.handleOutput({ kind: 'agent_text', text: 'Like it?', streaming: false });

    const chip = ctx.overlayContainer!.querySelector('.speech-chip') as HTMLDivElement;
    chip.click();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ kind: 'chat_message', text: 'Yes' });
  });

  it('positions above pet normally', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Up here', streaming: false });

    const bubble = ctx.overlayContainer!.querySelector('.speech-bubble') as HTMLDivElement;
    const top = parseInt(bubble.style.top, 10);
    // pet y=300, bubble should be above (top < 300)
    expect(top).toBeLessThan(300);
  });

  it('positions below pet when near top of screen', () => {
    const ctxNearTop = createMockContext({
      getPetPosition: () => ({ x: 100, y: 30, width: 64, height: 64 }),
    });
    mode.mount(ctxNearTop);
    mode.handleOutput({ kind: 'agent_text', text: 'Down here', streaming: false });

    const bubble = ctxNearTop.overlayContainer!.querySelector('.speech-bubble') as HTMLDivElement;
    const top = parseInt(bubble.style.top, 10);
    // pet y=30 is near top, bubble should flip below
    expect(top).toBeGreaterThan(30 + 64);
  });

  it('ignores irrelevant output types', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_emotion', emotion: 'happy' });

    const bubble = ctx.overlayContainer!.querySelector('.speech-bubble') as HTMLDivElement;
    expect(bubble.style.display).toBe('none');
  });
});
