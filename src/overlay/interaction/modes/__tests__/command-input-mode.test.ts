import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandInputMode, parseCommand, COMMANDS } from '../command-input-mode';
import type { ModeContext, InteractionEvent } from '../../types';

function createMockContext(): ModeContext {
  return {
    canvas: null,
    overlayContainer: document.createElement('div'),
    getPetPosition: () => ({ x: 100, y: 200, width: 64, height: 64 }),
    getPetState: () => 'idle',
    dispatch: vi.fn(),
  };
}

describe('CommandInputMode', () => {
  let mode: CommandInputMode;
  let ctx: ModeContext;

  beforeEach(() => {
    mode = new CommandInputMode();
    ctx = createMockContext();
  });

  afterEach(() => {
    mode.unmount();
  });

  it('has correct mode metadata', () => {
    expect(mode.type).toBe('command_input');
    expect(mode.surface).toBe('dom');
    expect(mode.tier).toBe('active');
  });

  it('declares capabilities', () => {
    const caps = mode.capabilities();
    expect(caps.displaysText).toBe(true);
    expect(caps.acceptsTextInput).toBe(true);
    expect(caps.requiresWebview).toBe(false);
    expect(caps.allowsConcurrent).toBe(false);
  });

  it('creates input bar on mount', () => {
    mode.mount(ctx);
    const input = ctx.overlayContainer!.querySelector('.command-input-bar');
    expect(input).toBeTruthy();
  });

  it('removes DOM on unmount', () => {
    mode.mount(ctx);
    mode.unmount();
    const input = ctx.overlayContainer!.querySelector('.command-input-bar');
    expect(input).toBeNull();
  });

  it('dispatches chat_message for free text', () => {
    mode.mount(ctx);
    mode.submitText('hello there');
    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'chat_message',
      text: 'hello there',
    });
  });

  it('dispatches care_action for feed command', () => {
    mode.mount(ctx);
    mode.submitText('/feed');
    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'care_action',
      action: 'feed',
    });
  });

  it('dispatches care_action for play command', () => {
    mode.mount(ctx);
    mode.submitText('/play');
    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'care_action',
      action: 'play',
    });
  });

  it('dispatches care_action for pet command', () => {
    mode.mount(ctx);
    mode.submitText('/pet');
    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'care_action',
      action: 'pet',
    });
  });

  it('dispatches care_action for sleep command', () => {
    mode.mount(ctx);
    mode.submitText('/sleep');
    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'care_action',
      action: 'sleep',
    });
  });

  it('dispatches chat_message for say command with text', () => {
    mode.mount(ctx);
    mode.submitText('/say I feel happy today');
    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'chat_message',
      text: 'I feel happy today',
    });
  });

  it('dispatches command for status query', () => {
    mode.mount(ctx);
    mode.submitText('/status');
    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'command',
      raw: '/status',
      parsed: { verb: 'status' },
    });
  });

  it('dispatches command for mood query', () => {
    mode.mount(ctx);
    mode.submitText('/mood');
    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'command',
      raw: '/mood',
      parsed: { verb: 'mood' },
    });
  });

  it('dispatches command for help', () => {
    mode.mount(ctx);
    mode.submitText('/help');
    expect(ctx.dispatch).toHaveBeenCalledWith({
      kind: 'command',
      raw: '/help',
      parsed: { verb: 'help' },
    });
  });

  it('ignores empty input', () => {
    mode.mount(ctx);
    mode.submitText('');
    mode.submitText('   ');
    expect(ctx.dispatch).not.toHaveBeenCalled();
  });

  it('provides autocomplete suggestions', () => {
    const suggestions = COMMANDS.filter(c => c.startsWith('/f'));
    expect(suggestions).toContain('/feed');
  });
});

describe('parseCommand', () => {
  it('parses slash commands', () => {
    const result = parseCommand('/feed');
    expect(result).toEqual({
      type: 'care_action',
      action: 'feed',
    });
  });

  it('parses /say with text', () => {
    const result = parseCommand('/say hello world');
    expect(result).toEqual({
      type: 'chat_message',
      text: 'hello world',
    });
  });

  it('parses free text as chat_message', () => {
    const result = parseCommand('just talking here');
    expect(result).toEqual({
      type: 'chat_message',
      text: 'just talking here',
    });
  });

  it('parses /status as command', () => {
    const result = parseCommand('/status');
    expect(result).toEqual({
      type: 'command',
      verb: 'status',
    });
  });

  it('parses /mood as command', () => {
    const result = parseCommand('/mood');
    expect(result).toEqual({
      type: 'command',
      verb: 'mood',
    });
  });

  it('parses /help as command', () => {
    const result = parseCommand('/help');
    expect(result).toEqual({
      type: 'command',
      verb: 'help',
    });
  });

  it('parses /settings as command', () => {
    const result = parseCommand('/settings');
    expect(result).toEqual({
      type: 'command',
      verb: 'settings',
    });
  });

  it('parses /remember with text', () => {
    const result = parseCommand('/remember my favorite color is blue');
    expect(result).toEqual({
      type: 'command',
      verb: 'remember',
      text: 'my favorite color is blue',
    });
  });

  it('parses /recall with text', () => {
    const result = parseCommand('/recall favorite color');
    expect(result).toEqual({
      type: 'command',
      verb: 'recall',
      text: 'favorite color',
    });
  });

  it('parses /dance as state command', () => {
    const result = parseCommand('/dance');
    expect(result).toEqual({
      type: 'command',
      verb: 'dance',
    });
  });

  it('parses /sit as state command', () => {
    const result = parseCommand('/sit');
    expect(result).toEqual({
      type: 'command',
      verb: 'sit',
    });
  });

  it('returns null for empty input', () => {
    expect(parseCommand('')).toBeNull();
    expect(parseCommand('   ')).toBeNull();
  });
});
