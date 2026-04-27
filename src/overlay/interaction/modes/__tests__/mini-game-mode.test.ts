import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MiniGameMode } from '../mini-game-mode';
import type { ModeContext } from '../../types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockedInvoke = invoke as ReturnType<typeof vi.fn>;

function createMockContext(): ModeContext {
  return {
    canvas: null,
    overlayContainer: document.createElement('div'),
    getPetPosition: () => ({ x: 100, y: 200, width: 64, height: 64 }),
    getPetState: () => 'idle',
    dispatch: vi.fn(),
  };
}

describe('MiniGameMode', () => {
  let mode: MiniGameMode;
  let ctx: ModeContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mode = new MiniGameMode();
    ctx = createMockContext();
    mockedInvoke.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mode.unmount();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('mini_game');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('active');
  });

  it('declares capabilities', () => {
    const caps = mode.capabilities();
    expect(caps.displaysText).toBe(true);
    expect(caps.acceptsTextInput).toBe(false);
    expect(caps.displaysChoices).toBe(true);
    expect(caps.triggersCareActions).toBe(true);
    expect(caps.allowsConcurrent).toBe(false);
  });

  it('starts in idle state', () => {
    expect(mode.getState()).toBe('idle');
  });

  it('creates container on mount', () => {
    mode.mount(ctx);
    const container = ctx.overlayContainer!.querySelector('.mini-game-container');
    expect(container).toBeTruthy();
  });

  it('removes DOM on unmount', () => {
    mode.mount(ctx);
    mode.unmount();
    const container = ctx.overlayContainer!.querySelector('.mini-game-container');
    expect(container).toBeNull();
  });

  it('shows game selection on care_action_play output', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_action_play' });

    expect(mode.getState()).toBe('select_game');
    const container = ctx.overlayContainer!.querySelector('.mini-game-container') as HTMLElement;
    expect(container.style.display).toBe('flex');
    expect(container.textContent).toContain('Play with me!');
    expect(container.textContent).toContain('RPS');
    expect(container.textContent).toContain('Catch');
  });

  it('ignores non-care_action_play outputs', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello!', streaming: false });
    mode.handleOutput({ kind: 'agent_emotion', emotion: 'happy' });

    expect(mode.getState()).toBe('idle');
  });

  it('starts RPS game via IPC', async () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_action_play' });

    const rpsBtn = ctx.overlayContainer!.querySelector('button')!;
    expect(rpsBtn.textContent).toContain('RPS');
    rpsBtn.click();

    await vi.waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith('start_mini_game', { gameType: 'rps' });
    });

    expect(mode.getState()).toBe('playing_rps');
  });

  it('plays 5 RPS rounds then ends', async () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_action_play' });

    // Click RPS button to start
    const rpsBtn = ctx.overlayContainer!.querySelector('button')!;
    rpsBtn.click();

    await vi.waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith('start_mini_game', { gameType: 'rps' });
    });

    // Play 5 rounds
    for (let i = 0; i < 5; i++) {
      const container = ctx.overlayContainer!.querySelector('.mini-game-container')!;
      const choiceButtons = container.querySelectorAll('button');
      // Choice buttons are the emoji ones (🪨📄✂️)
      const choiceBtn = Array.from(choiceButtons).find(b =>
        b.textContent?.includes('🪨') || b.textContent?.includes('📄') || b.textContent?.includes('✂️')
      );
      if (choiceBtn) choiceBtn.click();
    }

    // After 5 rounds, should show result
    await vi.waitFor(() => {
      expect(mode.getState()).toBe('result');
    });
    expect(mockedInvoke).toHaveBeenCalledWith(
      'submit_mini_game_result',
      expect.objectContaining({ gameType: 'rps', won: expect.any(Boolean) }),
    );
  });

  it('starts Catch game', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_action_play' });

    const buttons = ctx.overlayContainer!.querySelectorAll('button');
    const catchBtn = Array.from(buttons).find(b => b.textContent?.includes('Catch'))!;
    catchBtn.click();

    expect(mode.getState()).toBe('playing_catch');
    const container = ctx.overlayContainer!.querySelector('.mini-game-container')!;
    expect(container.textContent).toContain('Catch the Food!');
  });

  it('dispatches mini_game_result on result close', async () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_action_play' });

    // Start RPS
    const rpsBtn = ctx.overlayContainer!.querySelector('button')!;
    rpsBtn.click();

    await vi.waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith('start_mini_game', { gameType: 'rps' });
    });

    // Play 5 rounds to get to result state
    for (let i = 0; i < 5; i++) {
      const container = ctx.overlayContainer!.querySelector('.mini-game-container')!;
      const choiceButtons = container.querySelectorAll('button');
      const choiceBtn = Array.from(choiceButtons).find(b =>
        b.textContent?.includes('🪨') || b.textContent?.includes('📄') || b.textContent?.includes('✂️')
      );
      if (choiceBtn) choiceBtn.click();
    }

    await vi.waitFor(() => {
      expect(mode.getState()).toBe('result');
    });

    // Click Close button to dispatch result
    const closeBtn = ctx.overlayContainer!.querySelector('button:last-child') as HTMLButtonElement;
    closeBtn.click();

    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'mini_game_result',
      game: 'rps',
      score: expect.any(Number),
      won: expect.any(Boolean),
    });
    expect(mode.getState()).toBe('idle');
  });

  it('cleanups timers on unmount during catch game', () => {
    vi.useFakeTimers();
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_action_play' });

    const buttons = ctx.overlayContainer!.querySelectorAll('button');
    const catchBtn = Array.from(buttons).find(b => b.textContent?.includes('Catch'))!;
    catchBtn.click();

    expect(mode.getState()).toBe('playing_catch');

    mode.unmount();
    expect(mode.getState()).toBe('idle');

    // Timers should not fire after unmount
    vi.advanceTimersByTime(35000);

    vi.useRealTimers();
  });

  it('hides and resets to idle on game selection close', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'care_action_play' });
    expect(mode.getState()).toBe('select_game');

    const closeButton = Array.from(ctx.overlayContainer!.querySelectorAll('button'))
      .find(b => b.textContent === 'Close')!;
    closeButton.click();

    expect(mode.getState()).toBe('idle');
    const container = ctx.overlayContainer!.querySelector('.mini-game-container') as HTMLElement;
    expect(container.style.display).toBe('none');
  });
});
