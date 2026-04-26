import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractionRouter } from '../interaction-router';
import { InteractionProfileManager, InteractionProfile } from '../profile-manager';
import type { InteractionMode, ModeContext, InteractionEvent } from '../types';
import { BarkMode } from '../modes/bark-mode';
import { ThoughtBubbleMode } from '../modes/thought-bubble-mode';
import { SpeechBubbleMode } from '../modes/speech-bubble-mode';
import { RadialMenuMode } from '../modes/radial-menu-mode';
import { EmoteWheelMode } from '../modes/emote-wheel-mode';
import { BondIndicatorMode } from '../modes/bond-indicator-mode';
import { DialogPanelMode } from '../modes/dialog-panel-mode';

function createMockContext(): ModeContext {
  return {
    canvas: null,
    overlayContainer: document.createElement('div'),
    getPetPosition: () => ({ x: 0, y: 0, width: 64, height: 64 }),
    getPetState: () => 'idle',
    dispatch: vi.fn(),
  };
}

describe('Interaction profiles', () => {
  let router: InteractionRouter;
  let profileManager: InteractionProfileManager;
  let ctx: ModeContext;

  beforeEach(() => {
    router = new InteractionRouter();
    profileManager = new InteractionProfileManager(router);
    ctx = createMockContext();
  });

  describe('Minimal profile', () => {
    it('enables only bark and thought_bubble modes', () => {
      profileManager.applyProfile('minimal', ctx);

      const active = router.activeModes();
      expect(active).toContain('bark');
      expect(active).toContain('thought_bubble');
      expect(active).not.toContain('speech_bubble');
      expect(active).not.toContain('radial_menu');
    });

    it('does not map any gestures', () => {
      profileManager.applyProfile('minimal', ctx);

      expect(router.handleGesture('double_click')).toBe(false);
      expect(router.handleGesture('context_menu')).toBe(false);
      expect(router.handleGesture('emote_key')).toBe(false);
    });
  });

  describe('Nurture profile', () => {
    it('enables bark, thought_bubble, radial_menu, bond_level, touch_zone', () => {
      profileManager.applyProfile('nurture', ctx);

      const active = router.activeModes();
      expect(active).toContain('bark');
      expect(active).toContain('thought_bubble');
      expect(active).toContain('radial_menu');
      expect(active).toContain('bond_level');
    });

    it('maps context_menu to radial_menu', () => {
      profileManager.applyProfile('nurture', ctx);

      const events: InteractionEvent[] = [];
      router.onEvent((e) => events.push(e));

      expect(router.handleGesture('context_menu')).toBe(true);
    });
  });

  describe('RPG profile', () => {
    it('enables bark, thought_bubble, speech_bubble, radial_menu, bond_level', () => {
      profileManager.applyProfile('rpg', ctx);

      const active = router.activeModes();
      expect(active).toContain('bark');
      expect(active).toContain('thought_bubble');
      expect(active).toContain('speech_bubble');
      expect(active).toContain('radial_menu');
      expect(active).toContain('bond_level');
      // emote_wheel excluded because radial_menu (Group B first) takes priority
      expect(active).not.toContain('emote_wheel');
    });

    it('maps double_click to speech_bubble and context_menu to radial_menu', () => {
      profileManager.applyProfile('rpg', ctx);

      const events: InteractionEvent[] = [];
      router.onEvent((e) => events.push(e));

      expect(router.handleGesture('double_click')).toBe(true);
      expect(router.handleGesture('context_menu')).toBe(true);
    });
  });

  describe('Profile switching', () => {
    it('unmounts all modes from previous profile', () => {
      profileManager.applyProfile('rpg', ctx);
      expect(router.activeModes().length).toBeGreaterThan(3);

      profileManager.applyProfile('minimal', ctx);
      expect(router.activeModes().length).toBe(2);
    });

    it('correctly mounts new profile modes', () => {
      profileManager.applyProfile('minimal', ctx);
      profileManager.applyProfile('rpg', ctx);

      const active = router.activeModes();
      expect(active).toContain('speech_bubble');
      expect(active).toContain('radial_menu');
    });
  });

  describe('Mode compatibility enforcement', () => {
    it('Group A: speech_bubble and dialog_panel are mutually exclusive', () => {
      profileManager.applyProfile('rpg', ctx);

      const dialogMode = new DialogPanelMode();
      expect(() => router.enableMode(dialogMode)).toThrow('mutually exclusive');
    });

    it('Group B: radial_menu and emote_wheel are mutually exclusive', () => {
      profileManager.applyProfile('rpg', ctx);

      // radial_menu and emote_wheel are both active in RPG profile
      // This is a test constraint — RPG profile includes both but they shouldn't
      // coexist per MUTUALLY_EXCLUSIVE_GROUPS
      // The profile manager should handle this by only enabling one
      const active = router.activeModes();
      const hasBoth = active.includes('radial_menu') && active.includes('emote_wheel');
      expect(hasBoth).toBe(false);
    });
  });
});
