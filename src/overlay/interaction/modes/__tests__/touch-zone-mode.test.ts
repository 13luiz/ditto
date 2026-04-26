import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TouchZoneMode } from '../touch-zone-mode';
import type { ModeContext, InteractionEvent } from '../../types';

function createMockContext(overrides?: Partial<ModeContext>): ModeContext {
  return {
    canvas: null,
    overlayContainer: document.createElement('div'),
    getPetPosition: () => ({ x: 100, y: 200, width: 64, height: 64 }),
    getPetState: () => 'idle',
    dispatch: vi.fn(),
    ...overrides,
  };
}

const DEFAULT_ZONES = {
  head: { x: 16, y: 0, width: 32, height: 20 },
  body: { x: 8, y: 20, width: 48, height: 24 },
  belly: { x: 16, y: 32, width: 32, height: 16 },
  tail: { x: 0, y: 24, width: 12, height: 16 },
  limbs: { x: 8, y: 44, width: 48, height: 20 },
};

describe('TouchZoneMode', () => {
  let mode: TouchZoneMode;
  let ctx: ModeContext;
  let dispatched: InteractionEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    mode = new TouchZoneMode(DEFAULT_ZONES);
    dispatched = [];
    ctx = createMockContext({
      dispatch: (e) => dispatched.push(e),
    });
  });

  afterEach(() => {
    mode.unmount();
    vi.useRealTimers();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('touch_zone');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('passive');
  });

  it('creates zone overlay on mount', () => {
    mode.mount(ctx);
    expect(ctx.overlayContainer!.querySelector('.touch-zone-overlay')).toBeTruthy();
  });

  it('removes DOM on unmount', () => {
    mode.mount(ctx);
    mode.unmount();
    expect(ctx.overlayContainer!.querySelector('.touch-zone-overlay')).toBeNull();
  });

  it('hitTest returns correct zone name', () => {
    mode.mount(ctx);
    // head zone: x=16+100=116, y=0+200=200, relative to pet position
    const zone = mode.hitTest(116, 200);
    expect(zone).toBe('head');
  });

  it('hitTest returns null for point outside all zones', () => {
    mode.mount(ctx);
    const zone = mode.hitTest(0, 0);
    expect(zone).toBeNull();
  });

  it('hitTest detects body zone', () => {
    mode.mount(ctx);
    const zone = mode.hitTest(108, 220);
    expect(zone).toBe('body');
  });

  it('dispatches touch event on click in zone', () => {
    mode.mount(ctx);
    mode.handleClick(116, 200);

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ kind: 'touch', zone: 'head' });
  });

  it('does not dispatch for click outside zones', () => {
    mode.mount(ctx);
    mode.handleClick(0, 0);

    expect(dispatched).toHaveLength(0);
  });

  it('shows highlight on hover after 500ms', () => {
    mode.mount(ctx);
    mode.handleMouseMove(116, 200);

    // Before 500ms, no highlight
    expect(ctx.overlayContainer!.querySelector('.zone-highlight')).toBeNull();

    vi.advanceTimersByTime(500);

    const highlight = ctx.overlayContainer!.querySelector('.zone-highlight');
    expect(highlight).toBeTruthy();
  });

  it('removes highlight when mouse leaves zone', () => {
    mode.mount(ctx);
    mode.handleMouseMove(116, 200);
    vi.advanceTimersByTime(500);

    mode.handleMouseMove(0, 0);

    expect(ctx.overlayContainer!.querySelector('.zone-highlight')).toBeNull();
  });
});
