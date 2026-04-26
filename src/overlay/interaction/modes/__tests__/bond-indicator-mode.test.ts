import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BondIndicatorMode } from '../bond-indicator-mode';
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

describe('BondIndicatorMode', () => {
  let mode: BondIndicatorMode;
  let ctx: ModeContext;
  let dispatched: InteractionEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    dispatched = [];
    mode = new BondIndicatorMode();
    ctx = createMockContext({
      dispatch: (e) => dispatched.push(e),
    });
  });

  afterEach(() => {
    mode.unmount();
    vi.useRealTimers();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('bond_level');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('passive');
  });

  it('creates bond indicator on mount', () => {
    mode.mount(ctx);
    expect(ctx.overlayContainer!.querySelector('.bond-indicator')).toBeTruthy();
  });

  it('shows level display', () => {
    mode.mount(ctx);
    mode.setLevel(3, 150, 300);

    const level = ctx.overlayContainer!.querySelector('.bond-level-text');
    expect(level?.textContent).toContain('Lv.3');
  });

  it('shows progress bar', () => {
    mode.mount(ctx);
    mode.setLevel(3, 150, 300);

    const bar = ctx.overlayContainer!.querySelector('.bond-progress-fill') as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.style.width).toBeTruthy();
  });

  it('shows level-up ceremony on bond_level_up output', () => {
    mode.mount(ctx);
    mode.setLevel(2, 100, 150);

    mode.handleOutput({ kind: 'bond_level_up', oldLevel: 2, newLevel: 3 });

    const ceremony = ctx.overlayContainer!.querySelector('.bond-ceremony');
    expect(ceremony).toBeTruthy();
  });

  it('ceremony auto-hides after timeout', () => {
    mode.mount(ctx);
    mode.setLevel(2, 100, 150);

    mode.handleOutput({ kind: 'bond_level_up', oldLevel: 2, newLevel: 3 });

    vi.advanceTimersByTime(3000);

    const ceremony = ctx.overlayContainer!.querySelector('.bond-ceremony');
    expect(ceremony).toBeNull();
  });

  it('updates level display after level-up', () => {
    mode.mount(ctx);
    mode.setLevel(2, 100, 150);

    mode.handleOutput({ kind: 'bond_level_up', oldLevel: 2, newLevel: 3 });

    const level = ctx.overlayContainer!.querySelector('.bond-level-text');
    expect(level?.textContent).toContain('Lv.3');
  });

  it('removes DOM on unmount', () => {
    mode.mount(ctx);
    mode.unmount();
    expect(ctx.overlayContainer!.querySelector('.bond-indicator')).toBeNull();
  });

  it('positions near pet', () => {
    mode.mount(ctx);
    mode.setLevel(1, 25, 50);

    const indicator = ctx.overlayContainer!.querySelector('.bond-indicator') as HTMLElement;
    const pos = ctx.getPetPosition();
    // Should be below the pet
    const top = parseInt(indicator.style.top, 10);
    expect(top).toBeGreaterThan(pos.y + pos.height);
  });
});
