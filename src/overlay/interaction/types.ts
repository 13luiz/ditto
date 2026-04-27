export type InteractionModeType =
  | 'bark' | 'thought_bubble' | 'speech_bubble'
  | 'radial_menu' | 'emote_wheel' | 'touch_zone'
  | 'dialog_panel' | 'command_input' | 'chat_log'
  | 'mini_game' | 'dream_nail' | 'letter'
  | 'journal' | 'bond_level' | 'skit';

export type InteractionTier =
  | 'passive' | 'light' | 'active' | 'review' | 'meta';

export type RenderingSurface = 'canvas' | 'dom' | 'webview';

export type GestureType =
  | 'double_click' | 'context_menu' | 'long_press'
  | 'hover' | 'alt_hover' | 'emote_key' | 'shift_click';

export interface ModeCapabilities {
  displaysText: boolean;
  acceptsTextInput: boolean;
  displaysChoices: boolean;
  triggersCareActions: boolean;
  requiresWebview: boolean;
  allowsConcurrent: boolean;
  supportsMultiAgent: boolean;
}

export interface InteractionMode {
  readonly type: InteractionModeType;
  readonly displayName: string;
  readonly surface: RenderingSurface;
  readonly tier: InteractionTier;
  mount(context: ModeContext): void;
  unmount(): void;
  handleOutput(output: SystemOutput): void;
  capabilities(): ModeCapabilities;
}

export type SystemOutput =
  | { kind: 'agent_text'; text: string; streaming: boolean }
  | { kind: 'agent_tool_call'; tool: string; params: Record<string, unknown> }
  | { kind: 'agent_emotion'; emotion: string }
  | { kind: 'agent_inner_thought'; text: string }
  | { kind: 'care_state'; hunger: number; happiness: number;
      energy: number; social: number; mood: number; moodLabel: string }
  | { kind: 'care_need_critical'; need: CareNeed; value: number }
  | { kind: 'fsm_transition'; from: string; to: string }
  | { kind: 'bond_level_up'; oldLevel: number; newLevel: number }
  | { kind: 'letter_received'; letterId: string }
  | { kind: 'care_action_play' }
  | { kind: 'journal_entry_generated'; date: string; content: string }
  | { kind: 'skit_start'; participants: string[]; dialogue: SkitLine[] }
  | { kind: 'gesture'; type: GestureType };

export type CareNeed = 'hunger' | 'happiness' | 'energy' | 'social';

export type InteractionEvent =
  | { kind: 'chat_message'; text: string }
  | { kind: 'care_action'; action: 'feed' | 'pet' | 'play' | 'chat' | 'sleep' }
  | { kind: 'emote'; emote: string }
  | { kind: 'touch'; zone: 'head' | 'body' | 'belly' | 'tail' | 'limbs' }
  | { kind: 'command'; raw: string; parsed?: { verb: string; noun?: string } }
  | { kind: 'dream_nail_activate' }
  | { kind: 'dream_nail_used' }
  | { kind: 'letter_send'; content: string; attachment?: string }
  | { kind: 'mini_game_result'; game: string; score: number; won: boolean }
  | { kind: 'gesture'; type: GestureType };

export interface ModeContext {
  canvas: HTMLCanvasElement | null;
  overlayContainer: HTMLDivElement | null;
  getPetPosition(): { x: number; y: number; width: number; height: number };
  getPetState(): string;
  dispatch(event: InteractionEvent): void;
  config?: Record<string, unknown>;
}

export interface SkitLine {
  speaker: string;
  text: string;
  emotion?: string;
}

export type GestureMap = Partial<Record<GestureType, InteractionModeType>>;

export const MUTUALLY_EXCLUSIVE_GROUPS: InteractionModeType[][] = [
  ['speech_bubble', 'dialog_panel', 'command_input', 'chat_log'],
  ['radial_menu', 'emote_wheel'],
];

export const ALWAYS_CONCURRENT: InteractionModeType[] = [
  'bark', 'thought_bubble', 'touch_zone', 'bond_level',
];
