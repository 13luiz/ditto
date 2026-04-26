import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractionRouter } from '../interaction-router';
import type { InteractionMode, SystemOutput, InteractionEvent, GestureType } from '../types';

function createMockMode(type: string, caps: Partial<Record<string, boolean>> = {}): InteractionMode {
  return {
    type: type as any,
    displayName: type,
    surface: 'dom',
    tier: 'light',
    mount: vi.fn(),
    unmount: vi.fn(),
    handleOutput: vi.fn(),
    capabilities: () => ({
      displaysText: false,
      acceptsTextInput: false,
      displaysChoices: false,
      triggersCareActions: false,
      requiresWebview: false,
      allowsConcurrent: true,
      supportsMultiAgent: false,
      ...caps,
    }),
  };
}

describe('InteractionRouter', () => {
  let router: InteractionRouter;

  beforeEach(() => {
    router = new InteractionRouter();
  });

  it('creates with no active modes', () => {
    expect(router.activeModes()).toEqual([]);
  });

  describe('mode lifecycle', () => {
    it('enables a mode by calling mount', () => {
      const mode = createMockMode('bark');
      router.enableMode(mode);
      expect(mode.mount).toHaveBeenCalledOnce();
      expect(router.activeModes()).toContain('bark');
    });

    it('disables a mode by calling unmount', () => {
      const mode = createMockMode('bark');
      router.enableMode(mode);
      router.disableMode('bark');
      expect(mode.unmount).toHaveBeenCalledOnce();
      expect(router.activeModes()).not.toContain('bark');
    });

    it('ignores disabling a mode that is not active', () => {
      expect(() => router.disableMode('bark')).not.toThrow();
    });

    it('re-enabling a mode unmounts then remounts', () => {
      const mode = createMockMode('bark');
      router.enableMode(mode);
      router.enableMode(mode);
      expect(mode.unmount).toHaveBeenCalledOnce();
      expect(mode.mount).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleOutput', () => {
    it('routes output to all active modes', () => {
      const bark = createMockMode('bark');
      const thought = createMockMode('thought_bubble');
      router.enableMode(bark);
      router.enableMode(thought);

      const output: SystemOutput = { kind: 'agent_text', text: 'hello', streaming: false };
      router.handleOutput(output);

      expect(bark.handleOutput).toHaveBeenCalledWith(output);
      expect(thought.handleOutput).toHaveBeenCalledWith(output);
    });

    it('does not route output to disabled modes', () => {
      const bark = createMockMode('bark');
      router.enableMode(bark);
      router.disableMode('bark');

      const output: SystemOutput = { kind: 'agent_text', text: 'hello', streaming: false };
      router.handleOutput(output);

      expect(bark.handleOutput).not.toHaveBeenCalled();
    });
  });

  describe('handleGesture', () => {
    it('dispatches gesture to the mode mapped by gesture map', () => {
      const radial = createMockMode('radial_menu');
      radial.handleOutput = vi.fn();

      router.enableMode(radial);
      router.setGestureMap({ context_menu: 'radial_menu' });

      const dispatched = router.handleGesture('context_menu');
      expect(dispatched).toBe(true);
    });

    it('returns false when no mode is mapped for gesture', () => {
      const result = router.handleGesture('double_click');
      expect(result).toBe(false);
    });

    it('returns false when mapped mode is not active', () => {
      router.setGestureMap({ double_click: 'speech_bubble' });
      const result = router.handleGesture('double_click');
      expect(result).toBe(false);
    });
  });

  describe('dispatch (inbound)', () => {
    it('forwards interaction events to registered handlers', () => {
      const handler = vi.fn();
      router.onEvent(handler);

      const event: InteractionEvent = { kind: 'care_action', action: 'feed' };
      router.dispatch(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('supports multiple event handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      router.onEvent(handler1);
      router.onEvent(handler2);

      router.dispatch({ kind: 'care_action', action: 'feed' });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('compatibility groups', () => {
    it('rejects enabling speech_bubble when dialog_panel is active (Group A)', () => {
      const dialog = createMockMode('dialog_panel', { allowsConcurrent: false });
      const speech = createMockMode('speech_bubble', { allowsConcurrent: false });

      router.enableMode(dialog);
      expect(() => router.enableMode(speech)).toThrow(/mutually exclusive/i);
    });

    it('rejects enabling emote_wheel when radial_menu is active (Group B)', () => {
      const radial = createMockMode('radial_menu', { allowsConcurrent: false });
      const emote = createMockMode('emote_wheel', { allowsConcurrent: false });

      router.enableMode(radial);
      expect(() => router.enableMode(emote)).toThrow(/mutually exclusive/i);
    });

    it('allows always-concurrent modes alongside anything', () => {
      const bark = createMockMode('bark', { allowsConcurrent: true });
      const thought = createMockMode('thought_bubble', { allowsConcurrent: true });
      const bond = createMockMode('bond_level', { allowsConcurrent: true });

      router.enableMode(bark);
      router.enableMode(thought);
      router.enableMode(bond);

      expect(router.activeModes()).toContain('bark');
      expect(router.activeModes()).toContain('thought_bubble');
      expect(router.activeModes()).toContain('bond_level');
    });

    it('allows enabling speech_bubble after disabling dialog_panel', () => {
      const dialog = createMockMode('dialog_panel', { allowsConcurrent: false });
      const speech = createMockMode('speech_bubble', { allowsConcurrent: false });

      router.enableMode(dialog);
      router.disableMode('dialog_panel');
      expect(() => router.enableMode(speech)).not.toThrow();
    });
  });

  describe('bond-level gating', () => {
    it('rejects dream_nail when bond level < 5', () => {
      router.setBondLevel(4);
      const dreamNail = createMockMode('dream_nail');
      expect(() => router.enableMode(dreamNail)).toThrow(/bond/i);
      expect(router.activeModes()).not.toContain('dream_nail');
    });

    it('allows dream_nail when bond level >= 5', () => {
      router.setBondLevel(5);
      const dreamNail = createMockMode('dream_nail');
      expect(() => router.enableMode(dreamNail)).not.toThrow();
      expect(router.activeModes()).toContain('dream_nail');
    });

    it('rejects letter when bond level < 6', () => {
      router.setBondLevel(5);
      const letter = createMockMode('letter');
      expect(() => router.enableMode(letter)).toThrow(/bond/i);
    });

    it('allows letter when bond level >= 6', () => {
      router.setBondLevel(6);
      const letter = createMockMode('letter');
      expect(() => router.enableMode(letter)).not.toThrow();
    });

    it('rejects journal when bond level < 7', () => {
      router.setBondLevel(6);
      const journal = createMockMode('journal');
      expect(() => router.enableMode(journal)).toThrow(/bond/i);
    });

    it('allows journal when bond level >= 7', () => {
      router.setBondLevel(7);
      const journal = createMockMode('journal');
      expect(() => router.enableMode(journal)).not.toThrow();
    });

    it('rejects mini_game when bond level < 7', () => {
      router.setBondLevel(6);
      const miniGame = createMockMode('mini_game');
      expect(() => router.enableMode(miniGame)).toThrow(/bond/i);
    });

    it('allows mini_game when bond level >= 7', () => {
      router.setBondLevel(7);
      const miniGame = createMockMode('mini_game');
      expect(() => router.enableMode(miniGame)).not.toThrow();
    });

    it('allows ungated modes at any bond level', () => {
      router.setBondLevel(0);
      const bark = createMockMode('bark');
      expect(() => router.enableMode(bark)).not.toThrow();
    });
  });
});
