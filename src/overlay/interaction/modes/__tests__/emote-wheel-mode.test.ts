import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmoteWheelMode } from '../emote-wheel-mode';
import type { ModeContext, InteractionEvent } from '../../types';

function createMockContext(overrides?: Partial<ModeContext>): ModeContext {
  return {
    canvas: null,
    overlayContainer: document.createElement('div'),
    getPetPosition: () => ({ x: 200, y: 200, width: 64, height: 64 }),
    getPetState: () => 'idle',
    dispatch: vi.fn(),
    ...overrides,
  };
}

describe('EmoteWheelMode', () => {
  let mode: EmoteWheelMode;
  let ctx: ModeContext;
  let dispatched: InteractionEvent[];

  beforeEach(() => {
    mode = new EmoteWheelMode();
    dispatched = [];
    ctx = createMockContext({
      dispatch: (e) => dispatched.push(e),
    });
  });

  afterEach(() => {
    mode.unmount();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('emote_wheel');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('active');
  });

  it('creates DOM element on mount but hides it', () => {
    mode.mount(ctx);
    const wheel = ctx.overlayContainer!.querySelector('.emote-wheel');
    expect(wheel).toBeTruthy();
    expect((wheel as HTMLElement).style.display).toBe('none');
  });

  it('removes DOM element on unmount', () => {
    mode.mount(ctx);
    mode.unmount();
    expect(ctx.overlayContainer!.querySelector('.emote-wheel')).toBeNull();
  });

  it('opens on emote_key gesture output', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'gesture', type: 'emote_key' });

    const wheel = ctx.overlayContainer!.querySelector('.emote-wheel') as HTMLElement;
    expect(wheel.style.display).not.toBe('none');
  });

  it('renders 4 emote slots (Wave, Cheer, Scold, Dance)', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'gesture', type: 'emote_key' });

    const slots = ctx.overlayContainer!.querySelectorAll('.emote-slot');
    expect(slots.length).toBe(4);

    const labels = Array.from(slots).map((s) => s.getAttribute('data-emote'));
    expect(labels).toContain('wave');
    expect(labels).toContain('cheer');
    expect(labels).toContain('scold');
    expect(labels).toContain('dance');
  });

  it('dispatches emote event on slot click', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'gesture', type: 'emote_key' });

    const waveSlot = ctx.overlayContainer!.querySelector('[data-emote="wave"]') as HTMLElement;
    waveSlot.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ kind: 'emote', emote: 'wave' });
  });

  it('closes wheel after emote dispatch', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'gesture', type: 'emote_key' });

    const slot = ctx.overlayContainer!.querySelector('[data-emote="cheer"]') as HTMLElement;
    slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const wheel = ctx.overlayContainer!.querySelector('.emote-wheel') as HTMLElement;
    expect(wheel.style.display).toBe('none');
  });

  it('maps emotes to FSM states', () => {
    expect(mode.emoteToState('wave')).toBe('happy');
    expect(mode.emoteToState('cheer')).toBe('happy');
    expect(mode.emoteToState('scold')).toBe('sad');
    expect(mode.emoteToState('dance')).toBe('play');
  });

  it('maps emotes to bark text', () => {
    expect(mode.emoteToBark('wave')).toBe('*waves happily*');
    expect(mode.emoteToBark('cheer')).toBe('Yay!');
    expect(mode.emoteToBark('scold')).toBe('...');
    expect(mode.emoteToBark('dance')).toBe('~dance dance~');
  });

  it('ignores non-gesture outputs', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'hello', streaming: false });

    const wheel = ctx.overlayContainer!.querySelector('.emote-wheel') as HTMLElement;
    expect(wheel.style.display).toBe('none');
  });
});
