import type { InteractionRouter } from './interaction-router';
import type { ModeContext, GestureMap, InteractionMode } from './types';
import { BarkMode } from './modes/bark-mode';
import { ThoughtBubbleMode } from './modes/thought-bubble-mode';
import { SpeechBubbleMode } from './modes/speech-bubble-mode';
import { RadialMenuMode } from './modes/radial-menu-mode';
import { EmoteWheelMode } from './modes/emote-wheel-mode';
import { BondIndicatorMode } from './modes/bond-indicator-mode';
import { DialogPanelMode } from './modes/dialog-panel-mode';
import { DreamNailMode } from './modes/dream-nail-mode';
import { LetterMode } from './modes/letter-mode';
import { JournalMode } from './modes/journal-mode';
import { CommandInputMode } from './modes/command-input-mode';
import { ChatLogMode } from './modes/chat-log-mode';

export type InteractionProfile = 'minimal' | 'nurture' | 'rpg';

interface ProfileConfig {
  modes: string[];
  gestureMap: GestureMap;
}

const PROFILES: Record<InteractionProfile, ProfileConfig> = {
  minimal: {
    modes: ['bark', 'thought_bubble'],
    gestureMap: {},
  },
  nurture: {
    modes: ['bark', 'thought_bubble', 'radial_menu', 'bond_level', 'letter', 'journal', 'mini_game'],
    gestureMap: {
      context_menu: 'radial_menu',
    },
  },
  rpg: {
    modes: ['bark', 'thought_bubble', 'speech_bubble', 'radial_menu', 'emote_wheel', 'bond_level', 'dream_nail', 'letter', 'journal', 'mini_game', 'command_input', 'chat_log'],
    gestureMap: {
      double_click: 'speech_bubble',
      context_menu: 'radial_menu',
      emote_key: 'emote_wheel',
      alt_hover: 'dream_nail',
    },
  },
};

// radial_menu and emote_wheel are mutually exclusive (Group B)
// RPG profile includes both but only one can be active at a time
function resolveModes(modes: string[]): string[] {
  const result: string[] = [];
  let hasGroupB = false;
  for (const mode of modes) {
    if (mode === 'radial_menu' || mode === 'emote_wheel') {
      if (!hasGroupB) {
        result.push(mode);
        hasGroupB = true;
      }
    } else {
      result.push(mode);
    }
  }
  return result;
}

const MODE_FACTORIES: Record<string, () => InteractionMode> = {
  bark: () => new BarkMode(),
  thought_bubble: () => new ThoughtBubbleMode(),
  speech_bubble: () => new SpeechBubbleMode(),
  radial_menu: () => new RadialMenuMode(),
  emote_wheel: () => new EmoteWheelMode(),
  bond_level: () => new BondIndicatorMode(),
  dialog_panel: () => new DialogPanelMode(),
  dream_nail: () => new DreamNailMode(),
  letter: () => new LetterMode(),
  journal: () => new JournalMode(),
  command_input: () => new CommandInputMode(),
  chat_log: () => new ChatLogMode(),
};

export class InteractionProfileManager {
  private router: InteractionRouter;
  private currentProfile: InteractionProfile | null = null;

  constructor(router: InteractionRouter) {
    this.router = router;
  }

  applyProfile(profile: InteractionProfile, context: ModeContext): void {
    // Disable all current modes
    for (const modeType of this.router.activeModes()) {
      this.router.disableMode(modeType);
    }

    this.currentProfile = profile;
    const config = PROFILES[profile];
    const resolvedModes = resolveModes(config.modes);

    // Enable modes for new profile
    for (const modeType of resolvedModes) {
      const factory = MODE_FACTORIES[modeType];
      if (factory) {
        const mode = factory();
        this.router.enableMode(mode);
      }
    }

    // Filter gesture map to only include active modes
    const activeSet = new Set(this.router.activeModes());
    const filteredMap: GestureMap = {};
    for (const [gesture, target] of Object.entries(config.gestureMap)) {
      if (activeSet.has(target)) {
        filteredMap[gesture as keyof GestureMap] = target;
      }
    }
    this.router.setGestureMap(filteredMap);
  }

  getCurrentProfile(): InteractionProfile | null {
    return this.currentProfile;
  }
}
