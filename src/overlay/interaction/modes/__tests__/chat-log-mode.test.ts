import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatLogMode } from '../chat-log-mode';
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

describe('ChatLogMode', () => {
  let mode: ChatLogMode;
  let ctx: ModeContext;

  beforeEach(() => {
    mode = new ChatLogMode();
    ctx = createMockContext();
  });

  afterEach(() => {
    mode.unmount();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('chat_log');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('review');
  });

  it('declares capabilities', () => {
    const caps = mode.capabilities();
    expect(caps.displaysText).toBe(true);
    expect(caps.acceptsTextInput).toBe(false);
    expect(caps.requiresWebview).toBe(true);
    expect(caps.allowsConcurrent).toBe(false);
  });

  it('creates log container on mount with visible display', () => {
    mode.mount(ctx);
    const container = ctx.overlayContainer!.querySelector('.chat-log-container');
    expect(container).toBeTruthy();
    expect((container as HTMLElement).style.display).not.toBe('none');
  });

  it('removes DOM on unmount', () => {
    mode.mount(ctx);
    mode.unmount();
    const container = ctx.overlayContainer!.querySelector('.chat-log-container');
    expect(container).toBeNull();
  });

  it('logs chat messages', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello!', streaming: false });

    expect(mode.getEntries()).toHaveLength(1);
    expect(mode.getEntries()[0].type).toBe('chat');
    expect(mode.getEntries()[0].content).toBe('Hello!');
  });

  it('logs FSM transitions as system entries', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'fsm_transition', from: 'idle', to: 'walk_left' });

    expect(mode.getEntries()).toHaveLength(1);
    expect(mode.getEntries()[0].type).toBe('system');
  });

  it('logs bond level up events as system entries', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'bond_level_up', oldLevel: 2, newLevel: 3 });

    expect(mode.getEntries()).toHaveLength(1);
    expect(mode.getEntries()[0].type).toBe('system');
  });

  it('logs agent tool calls as memory entries', () => {
    mode.mount(ctx);
    mode.handleOutput({
      kind: 'agent_tool_call',
      tool: 'remember',
      params: { key: 'fav_color', value: 'blue' },
    });

    expect(mode.getEntries()).toHaveLength(1);
    expect(mode.getEntries()[0].type).toBe('memory');
  });

  it('filters by tab - chat only shows chat entries', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hi', streaming: false });
    mode.handleOutput({ kind: 'fsm_transition', from: 'idle', to: 'happy' });
    mode.handleOutput({
      kind: 'agent_tool_call',
      tool: 'remember',
      params: { key: 'test' },
    });

    const chatEntries = mode.getEntriesByTab('chat');
    expect(chatEntries).toHaveLength(1);
    expect(chatEntries[0].type).toBe('chat');
  });

  it('filters by tab - system only shows system entries', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hi', streaming: false });
    mode.handleOutput({ kind: 'fsm_transition', from: 'idle', to: 'happy' });

    const systemEntries = mode.getEntriesByTab('system');
    expect(systemEntries).toHaveLength(1);
    expect(systemEntries[0].type).toBe('system');
  });

  it('filters by tab - memory only shows memory entries', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hi', streaming: false });
    mode.handleOutput({
      kind: 'agent_tool_call',
      tool: 'recall',
      params: { query: 'fav' },
    });

    const memoryEntries = mode.getEntriesByTab('memory');
    expect(memoryEntries).toHaveLength(1);
    expect(memoryEntries[0].type).toBe('memory');
  });

  it('all tab shows all entries merged chronologically', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hi', streaming: false });
    mode.handleOutput({ kind: 'fsm_transition', from: 'idle', to: 'happy' });
    mode.handleOutput({
      kind: 'agent_tool_call',
      tool: 'remember',
      params: {},
    });

    const allEntries = mode.getEntriesByTab('all');
    expect(allEntries).toHaveLength(3);
  });

  it('entries include timestamps', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hi', streaming: false });

    const entry = mode.getEntries()[0];
    expect(entry.timestamp).toBeTruthy();
    expect(typeof entry.timestamp).toBe('string');
  });

  it('ignores irrelevant outputs', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_emotion', emotion: 'happy' });
    mode.handleOutput({ kind: 'gesture', type: 'double_click' });

    expect(mode.getEntries()).toHaveLength(0);
  });

  it('caps entries at max capacity', () => {
    mode.mount(ctx);
    // Default cap is 200
    for (let i = 0; i < 250; i++) {
      mode.handleOutput({ kind: 'agent_text', text: `Msg ${i}`, streaming: false });
    }

    expect(mode.getEntries().length).toBeLessThanOrEqual(200);
  });

  it('clears entries', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello', streaming: false });
    expect(mode.getEntries()).toHaveLength(1);

    mode.clearEntries();
    expect(mode.getEntries()).toHaveLength(0);
  });

  it('shows recent entries as DOM elements', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Msg 1', streaming: false });
    mode.handleOutput({ kind: 'agent_text', text: 'Msg 2', streaming: false });

    expect(mode.getVisibleCount()).toBe(2);
    const container = ctx.overlayContainer!.querySelector('.chat-log-container') as HTMLElement;
    expect(container.children.length).toBe(2);
  });

  it('caps visible elements at 3', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'A', streaming: false });
    mode.handleOutput({ kind: 'agent_text', text: 'B', streaming: false });
    mode.handleOutput({ kind: 'agent_text', text: 'C', streaming: false });
    mode.handleOutput({ kind: 'agent_text', text: 'D', streaming: false });

    // Should cap at 3 visible, but all 4 are in memory
    expect(mode.getVisibleCount()).toBe(3);
    expect(mode.getEntries()).toHaveLength(4);
  });

  it('auto-fades visible entries after timeout', () => {
    vi.useFakeTimers();
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Fading', streaming: false });

    expect(mode.getVisibleCount()).toBe(1);

    // After 4000ms, fade begins; after 4500ms, element removed
    vi.advanceTimersByTime(4500);
    expect(mode.getVisibleCount()).toBe(0);

    vi.useRealTimers();
  });

  it('keeps all entries in memory regardless of visible count', () => {
    mode.mount(ctx);
    for (let i = 0; i < 5; i++) {
      mode.handleOutput({ kind: 'agent_text', text: `Msg ${i}`, streaming: false });
    }

    expect(mode.getVisibleCount()).toBeLessThanOrEqual(3);
    expect(mode.getEntries()).toHaveLength(5);
  });
});
