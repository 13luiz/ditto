import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JournalMode } from '../journal-mode';
import type { ModeContext } from '../../types';

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

describe('JournalMode', () => {
  let mode: JournalMode;
  let ctx: ModeContext;

  beforeEach(() => {
    mode = new JournalMode();
    ctx = createMockContext({ bondLevel: 8 });
  });

  afterEach(() => {
    mode.unmount();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('journal');
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

  it('creates journal indicator on mount when bond level sufficient', () => {
    mode.mount(ctx);
    const indicator = ctx.overlayContainer!.querySelector('.journal-indicator');
    expect(indicator).toBeTruthy();
  });

  it('removes DOM on unmount', () => {
    mode.mount(ctx);
    mode.unmount();
    const indicator = ctx.overlayContainer!.querySelector('.journal-indicator');
    expect(indicator).toBeNull();
  });

  it('shows locked message when bond level below 7', () => {
    const lowBondCtx = createMockContext({ bondLevel: 5 });
    mode.mount(lowBondCtx);

    const indicator = lowBondCtx.overlayContainer!.querySelector('.journal-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator!.textContent).toContain('Bond Lv.7');
  });

  it('does not show locked message when bond level >= 7', () => {
    mode.mount(ctx);
    const indicator = ctx.overlayContainer!.querySelector('.journal-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator!.textContent).not.toContain('Bond Lv.7');
  });

  it('ignores non-journal outputs', () => {
    mode.mount(ctx);
    mode.handleOutput({ kind: 'agent_text', text: 'Hello!', streaming: false });
    mode.handleOutput({ kind: 'agent_emotion', emotion: 'happy' });

    expect(mode.getEntryCount()).toBe(0);
  });

  it('handles journal_entry_generated output', () => {
    mode.mount(ctx);
    mode.handleOutput({
      kind: 'journal_entry_generated',
      date: '2026-04-26',
      content: 'Had 3 conversations today. Feeling good.',
    });

    expect(mode.getEntryCount()).toBe(1);
    expect(mode.getEntries()[0].date).toBe('2026-04-26');
    expect(mode.getEntries()[0].content).toContain('conversations');
  });

  it('shows notification overlay on journal_entry_generated', () => {
    vi.useFakeTimers();
    mode.mount(ctx);
    mode.handleOutput({
      kind: 'journal_entry_generated',
      date: '2026-04-26',
      content: 'Today was peaceful.',
    });

    const notification = ctx.overlayContainer!.querySelector('.journal-notification');
    expect(notification).toBeTruthy();
    expect(notification!.textContent).toContain('peaceful');

    vi.advanceTimersByTime(4500);
    vi.useRealTimers();
  });

  it('tracks journal entry count', () => {
    mode.mount(ctx);
    expect(mode.getEntryCount()).toBe(0);
  });

  it('stores journal entries', () => {
    mode.mount(ctx);
    mode.addEntry('2026-04-26', 'Had a great day today!', 'Happy');

    expect(mode.getEntryCount()).toBe(1);
    const entries = mode.getEntries();
    expect(entries[0].date).toBe('2026-04-26');
    expect(entries[0].content).toBe('Had a great day today!');
    expect(entries[0].mood).toBe('Happy');
  });

  it('does not add entries when bond level below 7', () => {
    const lowBondCtx = createMockContext({ bondLevel: 5 });
    mode.mount(lowBondCtx);
    mode.addEntry('2026-04-26', 'Should not add', 'Neutral');

    expect(mode.getEntryCount()).toBe(0);
  });

  it('retrieves entries by date range', () => {
    mode.mount(ctx);
    mode.addEntry('2026-04-24', 'Entry 1', 'Happy');
    mode.addEntry('2026-04-25', 'Entry 2', 'Sad');
    mode.addEntry('2026-04-26', 'Entry 3', 'Curious');

    const range = mode.getEntriesByRange('2026-04-24', '2026-04-25');
    expect(range).toHaveLength(2);
  });

  it('clears entries', () => {
    mode.mount(ctx);
    mode.addEntry('2026-04-26', 'Entry', 'Happy');
    expect(mode.getEntryCount()).toBe(1);

    mode.clearEntries();
    expect(mode.getEntryCount()).toBe(0);
  });
});
