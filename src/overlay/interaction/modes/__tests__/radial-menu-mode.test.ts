import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RadialMenuMode } from '../radial-menu-mode';
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

describe('RadialMenuMode', () => {
  let mode: RadialMenuMode;
  let ctx: ModeContext;
  let dispatched: InteractionEvent[];

  beforeEach(() => {
    mode = new RadialMenuMode();
    dispatched = [];
    ctx = createMockContext({
      dispatch: (e) => dispatched.push(e),
    });
  });

  afterEach(() => {
    mode.unmount();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('radial_menu');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('active');
  });

  it('creates DOM element on mount but hides it', () => {
    mode.mount(ctx);
    const menu = ctx.overlayContainer!.querySelector('.radial-menu');
    expect(menu).toBeTruthy();
    expect((menu as HTMLElement).style.display).toBe('none');
  });

  it('removes DOM element on unmount', () => {
    mode.mount(ctx);
    mode.unmount();
    expect(ctx.overlayContainer!.querySelector('.radial-menu')).toBeNull();
  });

  it('opens on context_menu gesture output', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'gesture', type: 'context_menu' });

    const menu = ctx.overlayContainer!.querySelector('.radial-menu') as HTMLElement;
    expect(menu.style.display).not.toBe('none');
  });

  it('renders 4 segments (Feed, Play, Sleep, Chat)', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'gesture', type: 'context_menu' });

    const segments = ctx.overlayContainer!.querySelectorAll('.radial-segment');
    expect(segments.length).toBe(4);

    const labels = Array.from(segments).map((s) => s.getAttribute('data-action'));
    expect(labels).toContain('feed');
    expect(labels).toContain('play');
    expect(labels).toContain('sleep');
    expect(labels).toContain('chat');
  });

  it('dispatches care_action on segment click', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'gesture', type: 'context_menu' });

    const feedSegment = ctx.overlayContainer!.querySelector('[data-action="feed"]') as SVGElement;
    feedSegment.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ kind: 'care_action', action: 'feed' });
  });

  it('closes menu after action dispatch', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'gesture', type: 'context_menu' });

    const segment = ctx.overlayContainer!.querySelector('[data-action="play"]') as SVGElement;
    segment.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const menu = ctx.overlayContainer!.querySelector('.radial-menu') as HTMLElement;
    expect(menu.style.display).toBe('none');
  });

  it('ignores non-gesture outputs', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'hello', streaming: false });

    const menu = ctx.overlayContainer!.querySelector('.radial-menu') as HTMLElement;
    expect(menu.style.display).toBe('none');
  });

  it('closes on outside click', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'gesture', type: 'context_menu' });

    const menu = ctx.overlayContainer!.querySelector('.radial-menu') as HTMLElement;
    expect(menu.style.display).not.toBe('none');

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(menu.style.display).toBe('none');
  });

  it('closes on Escape key', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'gesture', type: 'context_menu' });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    const menu = ctx.overlayContainer!.querySelector('.radial-menu') as HTMLElement;
    expect(menu.style.display).toBe('none');
  });
});
