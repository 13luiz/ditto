import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DreamNailMode } from '../dream-nail-mode';
import type { ModeContext, InteractionEvent } from '../../types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockedInvoke = invoke as ReturnType<typeof vi.fn>;

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
    vi.clearAllMocks();
    mode = new DreamNailMode();
    ctx = createMockContext({ bondLevel: 7 });
    mockedInvoke.mockResolvedValue({ count: 0 });
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

  it('calls generate_inner_thought IPC on trigger', async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_dream_nail_uses') return Promise.resolve({ count: 0 });
      if (cmd === 'generate_inner_thought') return Promise.resolve({ thought: 'I wonder...', pet_name: 'Ditto' });
      return Promise.resolve({});
    });

    await mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });

    await vi.waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith('generate_inner_thought', expect.objectContaining({
        mood: 'neutral',
      }));
    });
  });

  it('displays thought from IPC in italic translucent overlay', async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_dream_nail_uses') return Promise.resolve({ count: 0 });
      if (cmd === 'generate_inner_thought') return Promise.resolve({ thought: '...so quiet today...', pet_name: 'Ditto' });
      return Promise.resolve({});
    });

    await mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });

    await vi.waitFor(() => {
      const overlay = ctx.overlayContainer!.querySelector('.dream-nail-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay!.textContent).toContain('so quiet today');
    });

    const overlay = ctx.overlayContainer!.querySelector('.dream-nail-overlay') as HTMLDivElement;
    expect(overlay.style.fontStyle).toBe('italic');
  });

  it('positions dream overlay above pet', async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_dream_nail_uses') return Promise.resolve({ count: 0 });
      if (cmd === 'generate_inner_thought') return Promise.resolve({ thought: '...hello...', pet_name: 'Ditto' });
      return Promise.resolve({});
    });

    await mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });

    await vi.waitFor(() => {
      const overlay = ctx.overlayContainer!.querySelector('.dream-nail-overlay') as HTMLDivElement;
      expect(overlay).toBeTruthy();
      expect(overlay.style.position).toBe('absolute');
    });
  });

  it('auto-fades after display period', async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_dream_nail_uses') return Promise.resolve({ count: 0 });
      if (cmd === 'generate_inner_thought') return Promise.resolve({ thought: '...temporary...', pet_name: 'Ditto' });
      return Promise.resolve({});
    });

    await mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });

    await vi.waitFor(() => {
      expect(ctx.overlayContainer!.querySelector('.dream-nail-overlay')).toBeTruthy();
    });

    const overlay = ctx.overlayContainer!.querySelector('.dream-nail-overlay') as HTMLDivElement;
    vi.advanceTimersByTime(5500);
    expect(overlay.style.opacity).toBe('0');
  });

  it('ignores non-inner-thought outputs', async () => {
    mockedInvoke.mockResolvedValue({ count: 0 });
    await mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello!', streaming: false });
    mode.handleOutput({ kind: 'agent_emotion', emotion: 'happy' });

    expect(ctx.overlayContainer!.querySelector('.dream-nail-overlay')).toBeNull();
  });

  it('emits dream_nail_used event via dispatch', async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_dream_nail_uses') return Promise.resolve({ count: 0 });
      if (cmd === 'generate_inner_thought') return Promise.resolve({ thought: '...peeking...', pet_name: 'Ditto' });
      return Promise.resolve({});
    });

    await mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });

    await vi.waitFor(() => {
      expect(ctx.dispatch).toHaveBeenCalledWith({ kind: 'dream_nail_used' });
    });
  });

  it('refuses if bond level below 5', async () => {
    mockedInvoke.mockResolvedValue({ count: 0 });
    const lowBondCtx = createMockContext({ bondLevel: 3 });
    await mode.mount(lowBondCtx);
    mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });

    await vi.waitFor(() => {
      const overlay = lowBondCtx.overlayContainer!.querySelector('.dream-nail-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay!.textContent).toContain('Bond Lv.5');
    });
  });

  it('does not emit event when locked', async () => {
    mockedInvoke.mockResolvedValue({ count: 0 });
    const lowBondCtx = createMockContext({ bondLevel: 3 });
    await mode.mount(lowBondCtx);
    mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });

    await vi.waitFor(() => {
      expect(lowBondCtx.overlayContainer!.querySelector('.dream-nail-overlay')).toBeTruthy();
    });
    expect(lowBondCtx.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'dream_nail_used' }));
  });

  it('rate limits to 3 uses per day', async () => {
    let useCount = 0;
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_dream_nail_uses') return Promise.resolve({ count: 0 });
      if (cmd === 'generate_inner_thought') {
        useCount++;
        return Promise.resolve({ thought: `...thought ${useCount}...`, pet_name: 'Ditto' });
      }
      return Promise.resolve({});
    });

    await mode.mount(ctx);

    for (let i = 0; i < 4; i++) {
      mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });
    }

    await vi.waitFor(() => {
      const dispatchCalls = (ctx.dispatch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => (call[0] as InteractionEvent).kind === 'dream_nail_used',
      );
      expect(dispatchCalls.length).toBe(3);
    });
  });

  it('loads daily uses from IPC on mount', async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_dream_nail_uses') return Promise.resolve({ count: 2 });
      return Promise.resolve({});
    });

    await mode.mount(ctx);
    expect(mode.getDailyUseCount()).toBe(2);
  });

  it('removes DOM elements on unmount', async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_dream_nail_uses') return Promise.resolve({ count: 0 });
      if (cmd === 'generate_inner_thought') return Promise.resolve({ thought: '...cleanup...', pet_name: 'Ditto' });
      return Promise.resolve({});
    });

    await mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });

    await vi.waitFor(() => {
      expect(ctx.overlayContainer!.querySelector('.dream-nail-overlay')).toBeTruthy();
    });

    mode.unmount();
    expect(ctx.overlayContainer!.querySelector('.dream-nail-overlay')).toBeNull();
  });

  it('tracks daily usage count', async () => {
    let useCount = 0;
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_dream_nail_uses') return Promise.resolve({ count: 0 });
      if (cmd === 'generate_inner_thought') {
        useCount++;
        return Promise.resolve({ thought: `...t${useCount}...`, pet_name: 'Ditto' });
      }
      return Promise.resolve({});
    });

    await mode.mount(ctx);
    expect(mode.getDailyUseCount()).toBe(0);

    mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });
    await vi.waitFor(() => expect(mode.getDailyUseCount()).toBe(1));

    mode.handleOutput({ kind: 'agent_inner_thought', text: 'trigger' });
    await vi.waitFor(() => expect(mode.getDailyUseCount()).toBe(2));
  });
});
