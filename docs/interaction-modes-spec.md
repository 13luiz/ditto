# Ditto — Interaction Modes Architecture Spec

> **Version:** 1.0
> **Date:** 2026-04-24
> **Status:** Proposal
> **Supersedes:** PRD Section 4.3 (Data Flow — User Interaction Flow, AI Conversation Flow)

---

## 1. Design Goals

| Goal | Description |
|------|-------------|
| **Multi-mode coexistence** | 15 interaction modes coexist in the same application; users choose which to enable |
| **Agent-Interaction decoupling** | Agent output (text, tool calls, emotions) is routed through an InteractionRouter; modes render it independently |
| **Progressive disturbance** | Five tiers from zero-disruption (Bark) to deep engagement (Dialog Panel); users control the ceiling |
| **Renderer-agnostic** | Interaction modes work identically with Sprite, Spine, Live2D, Lottie, and VRM renderers (per visual-rendering-spec.md) |
| **Single-pet complete, multi-Agent extensible** | All 15 modes work with a single pet; Skit System activates when multiple Agents are present |
| **User-configurable profiles** | Preset profiles ("Minimal", "Nurture", "RPG") and per-mode toggles let users shape the experience |

---

## 2. Architecture Overview

### 2.1 Core Principle

**The interaction mode is a projection of intent, not the intent itself.**

```
                                                  Interaction Modes
Agent / Care / FSM                                (stateless, swappable)
(stateful, authoritative)                         ┌──────────────────────┐
┌───────────────────────┐                         │                      │
│ Agent output:         │                         │  Bark  Bubble  Panel │
│   text, tool_call,    │──InteractionRouter──>   │  Radial  Emote  VN   │
│   emotion, inner      │                         │  Command  Log  ...   │
│                       │                         │                      │
│ Care state:           │<──InteractionEvent───   │  f(output) → visual  │
│   hunger, mood, ...   │                         │  f(click)  → event   │
│                       │                         └──────────────────────┘
│ FSM state:            │                              ↑ replaceable
│   idle, walk, talk    │                              ↑ user configurable
└───────────────────────┘                              ↑ renderer-agnostic
```

Agent/Care/FSM hold all meaningful state. Each interaction mode is a **pair of pure functions**: one mapping system output to visual presentation, another mapping user gestures to `InteractionEvent`s. Switching modes means switching these functions — the underlying state remains unchanged.

### 2.2 InteractionRouter

The InteractionRouter sits between the stateful backend and the visual interaction modes. It has two responsibilities:

1. **Outbound (system -> user):** Route Agent output, Care state changes, and FSM transitions to the appropriate active mode(s).
2. **Inbound (user -> system):** Collect user gestures from active modes, normalize them into `InteractionEvent`s, and dispatch to Agent/Care/FSM.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ditto Main Window                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   InteractionRouter                      │    │
│  │                                                         │    │
│  │  ┌──────────┐  Outbound Bus (system → modes)            │    │
│  │  │ Agent    ├──┬──> BarkMode.display(text)              │    │
│  │  │ Output   │  ├──> BubbleMode.display(text, choices)   │    │
│  │  └──────────┘  ├──> ThoughtMode.showIcon(need)          │    │
│  │                └──> PanelMode.appendMessage(msg)         │    │
│  │  ┌──────────┐                                           │    │
│  │  │ Care     ├──┬──> ThoughtMode.showIcon(need)          │    │
│  │  │ State    │  └──> BondLevel.checkLevelUp(stats)       │    │
│  │  └──────────┘                                           │    │
│  │  ┌──────────┐                                           │    │
│  │  │ FSM      ├──┬──> [all modes].onStateChange(state)    │    │
│  │  │ State    │  └──> LogMode.appendSystem(transition)     │    │
│  │  └──────────┘                                           │    │
│  │                                                         │    │
│  │  Inbound Bus (modes → system)                           │    │
│  │  RadialMenu.onSelect('feed') ──┐                        │    │
│  │  EmoteWheel.onEmote('wave')  ──┤                        │    │
│  │  TouchZone.onPet('head')     ──┼──> InteractionEvent    │    │
│  │  CommandInput.onCmd('sleep') ──┤        → dispatch()    │    │
│  │  Panel.onSend('hello')       ──┘                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────┐  ┌────────────────┐  ┌──────────────────────┐     │
│  │ Canvas  │  │ Overlay Layer  │  │ WebviewWindow(s)     │     │
│  │ (pet)   │  │ (bark, bubble, │  │ (dialog panel,       │     │
│  │         │  │  icons, radial)│  │  chat log, journal)  │     │
│  └─────────┘  └────────────────┘  └──────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Rendering Surface Strategy

Interaction modes render on one of three surfaces:

| Surface | Technology | Modes | Pros | Cons |
|---------|-----------|-------|------|------|
| **Canvas overlay** | Same `<canvas>` as pet sprite, or a second transparent `<canvas>` stacked on top | Bark, Thought Bubble, Touch Zone highlights | Zero latency, pixel-perfect alignment with pet | Limited to simple graphics, no HTML interactivity |
| **DOM overlay** | Absolutely-positioned HTML elements over the pet canvas | Speech Bubble, Radial Menu, Emote Wheel, Bond Level indicator | Full CSS animation, flexible layout, accessible | Z-index management, click-through coordination |
| **Separate WebviewWindow** | Tauri `WebviewWindow` (existing pattern: `chat-bubble.ts`, `care-panel.ts`) | Dialog Panel, Chat Log, Command Input, Journal, Letter, Mini-Game, Skit | Full HTML/CSS/JS, independent lifecycle | Resource cost per window, position sync required |

### 2.4 Relationship to Current Architecture

| Current Code | Refactoring Path |
|-------------|-----------------|
| `main.ts` hardcoded `dblclick` -> `toggleChatWindow()` | Replace with `InteractionRouter.handleGesture('double_click')` — router decides which mode to activate |
| `main.ts` hardcoded `contextmenu` -> `openCarePanel()` | Replace with `InteractionRouter.handleGesture('context_menu')` — router may open RadialMenu or CarePanel depending on config |
| `chat-bubble.ts` WebviewWindow pattern | Becomes one implementation behind `DialogPanelMode` |
| `care-panel.ts` WebviewWindow pattern | Becomes one option behind `RadialMenuMode` or remains as fallback |
| `pet-action` event listener in `main.ts` | Moves into `InteractionRouter.handleAgentAction()` — routes `speak` to Bark/Bubble/Panel depending on config |
| `ClickThroughHandler` alpha-based hit test | Extended: TouchZoneMode registers sub-regions; ClickThroughHandler reports which zone was hit |
| `ipc/commands.ts` — `sendChatMessage`, `onStreamToken` | Unchanged; DialogPanelMode and ChatLogMode consume these directly |

---

## 3. Core Protocol: InteractionMode Interface

### 3.1 Protocol Definition

```typescript
// ============================================================
// Core Protocol — all interaction modes MUST implement
// ============================================================

interface InteractionMode {
  /** Mode type identifier */
  readonly type: InteractionModeType;

  /** Human-readable display name (for settings UI) */
  readonly displayName: string;

  /** Which rendering surface this mode uses */
  readonly surface: 'canvas' | 'dom' | 'webview';

  /** Which interaction tier this mode belongs to */
  readonly tier: InteractionTier;

  /** Initialize the mode. Called when mode is enabled. */
  mount(context: ModeContext): void;

  /** Tear down the mode. Called when mode is disabled or switched. */
  unmount(): void;

  /** Handle outbound data from Agent/Care/FSM */
  handleOutput(output: SystemOutput): void;

  /** Query which optional capabilities this mode supports */
  capabilities(): ModeCapabilities;
}

type InteractionModeType =
  | 'bark' | 'thought_bubble' | 'speech_bubble'
  | 'radial_menu' | 'emote_wheel' | 'touch_zone'
  | 'dialog_panel' | 'command_input' | 'chat_log'
  | 'mini_game' | 'dream_nail' | 'letter'
  | 'journal' | 'bond_level' | 'skit';

type InteractionTier =
  | 'passive'    // pet -> user, zero user action required
  | 'light'      // simple click / hover / gesture
  | 'active'     // deep engagement, text input, sustained focus
  | 'review'     // async / historical, user browses at leisure
  | 'meta';      // cross-cutting system, operates across all tiers

interface ModeCapabilities {
  /** Can this mode display Agent text output? */
  displaysText: boolean;
  /** Can this mode accept user text input? */
  acceptsTextInput: boolean;
  /** Can this mode display choices / options? */
  displaysChoices: boolean;
  /** Can this mode trigger Care actions? */
  triggersCareActions: boolean;
  /** Does this mode require a separate WebviewWindow? */
  requiresWebview: boolean;
  /** Can this mode operate alongside other modes simultaneously? */
  allowsConcurrent: boolean;
  /** Does this mode support multi-Agent (Skit) scenarios? */
  supportsMultiAgent: boolean;
}
```

### 3.2 System Output Types

```typescript
/** Outbound: system -> interaction modes */
type SystemOutput =
  | { kind: 'agent_text'; text: string; streaming: boolean }
  | { kind: 'agent_tool_call'; tool: string; params: Record<string, unknown> }
  | { kind: 'agent_emotion'; emotion: string }
  | { kind: 'agent_inner_thought'; text: string }
  | { kind: 'care_state'; hunger: number; happiness: number;
      energy: number; social: number; mood: number; moodLabel: string }
  | { kind: 'care_need_critical'; need: CareNeed; value: number }
  | { kind: 'fsm_transition'; from: PetState; to: PetState }
  | { kind: 'bond_level_up'; oldLevel: number; newLevel: number }
  | { kind: 'letter_received'; letter: LetterData }
  | { kind: 'skit_start'; participants: string[]; dialogue: SkitLine[] };

type CareNeed = 'hunger' | 'happiness' | 'energy' | 'social';
```

### 3.3 Interaction Event Types

```typescript
/** Inbound: interaction modes -> system */
type InteractionEvent =
  | { kind: 'chat_message'; text: string }
  | { kind: 'care_action'; action: 'feed' | 'pet' | 'play' | 'chat' | 'sleep' }
  | { kind: 'emote'; emote: string }
  | { kind: 'touch'; zone: 'head' | 'body' | 'belly' | 'tail' | 'limbs' }
  | { kind: 'command'; raw: string; parsed?: { verb: string; noun?: string } }
  | { kind: 'dream_nail_activate' }
  | { kind: 'letter_send'; content: string; attachment?: string }
  | { kind: 'mini_game_result'; game: string; score: number; won: boolean }
  | { kind: 'gesture'; type: 'double_click' | 'context_menu'
      | 'long_press' | 'hover' | 'alt_hover' };
```

### 3.4 Mode Context

```typescript
/** Provided to every mode on mount() */
interface ModeContext {
  /** The pet canvas element (for canvas-overlay modes) */
  canvas: HTMLCanvasElement;

  /** DOM container for overlay elements (for dom-overlay modes) */
  overlayContainer: HTMLDivElement;

  /** Current pet position in physical screen coordinates */
  getPetPosition(): { x: number; y: number; width: number; height: number };

  /** Current pet state from FSM */
  getPetState(): PetState;

  /** Current care state */
  getCareState(): Promise<CareState>;

  /** Current bond level */
  getBondLevel(): number;

  /** Dispatch an interaction event to the router */
  dispatch(event: InteractionEvent): void;

  /** Reference to the active PetRenderer (for hitTest delegation) */
  renderer: PetRenderer;

  /** Interaction config for this mode */
  config: ModeSpecificConfig;
}
```

### 3.5 Mode Capability Matrix

| Mode | displaysText | acceptsInput | displaysChoices | triggersCare | webview | concurrent | multiAgent |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Bark | yes | no | no | no | no | yes | no |
| Thought Bubble | no | no | no | no | no | yes | no |
| Speech Bubble | yes | no | yes | no | no | yes | no |
| Radial Menu | no | no | yes | yes | no | no | no |
| Emote Wheel | no | no | yes | yes | no | no | no |
| Touch Zone | no | no | no | yes | no | yes | no |
| Dialog Panel | yes | yes | yes | no | yes | no | no |
| Command Input | yes | yes | no | yes | yes | no | no |
| Chat Log | yes | yes | no | no | yes | no | no |
| Mini-Game | no | no | no | yes | yes | no | no |
| Dream Nail | yes | no | no | no | no | no | no |
| Letter | yes | yes | no | no | yes | no | no |
| Journal | yes | no | no | no | yes | no | no |
| Bond Level | no | no | no | no | no | yes | no |
| Skit | yes | no | yes | no | yes | no | yes |

### 3.6 Mode Lifecycle

```
User enables mode in settings
         │
         v
  InteractionRouter.enableMode(type)
         │
         v
  mode = ModeFactory.create(type)
         │
         v
  mode.mount(context)          ← DOM/canvas elements created
         │
         v
  [mode is active — receives SystemOutput, emits InteractionEvent]
         │
         v
  User disables mode / switches profile
         │
         v
  mode.unmount()               ← DOM/canvas elements destroyed, listeners removed
         │
         v
  InteractionRouter.disableMode(type)
```

---

## 4. Interaction Mode Detailed Designs

### 4.1 Bark (Ambient Monologue)

**Tier:** Passive | **Surface:** Canvas overlay or DOM overlay

The pet produces short, ephemeral text fragments near its body. Text appears, lingers briefly, and fades out. No user action is required or expected. Barks are the primary channel for proactive Agent behavior — commenting on screen content, expressing needs, reacting to time-of-day.

**ASCII Prototype — Idle bark:**

```
                ┌─────────────────┐
                │  "好困啊..."    │ ← 12-20px text, semi-transparent bg
                └────────┬────────┘   auto-fade after 2-3 seconds
                         │
                    ┌──────────┐
                    │  (pet)   │
                    │  sprite  │
                    └──────────┘
    ════════════════════════════════════════  taskbar
```

**ASCII Prototype — Queued barks (new bark pushes old up):**

```
                ┌─────────────────┐  ← older bark, fading out (opacity 30%)
                │ "又在写代码..."  │
                └────────┬────────┘
                ┌─────────────────┐  ← current bark, full opacity
                │ "要注意休息哦~" │
                └────────┬────────┘
                         │
                    ┌──────────┐
                    │  (pet)   │
                    └──────────┘
```

**Interaction Flow:**

```
Trigger Source                   InteractionRouter                    BarkMode
─────────────                    ─────────────────                    ────────
Agent proactive timer fires
  │
  ├─> agent generates text ──>  handleOutput({                       
  │                               kind: 'agent_text',     ──────>   display(text)
  │                               text: '好困啊...',                  │
  │                               streaming: false                    ├─ create <div> above pet
  │                             })                                    ├─ typewriter anim (50ms/char)
  │                                                                   ├─ hold 2500ms
  │                                                                   └─ fadeOut 500ms, remove
  │
Care need crosses threshold
  │
  ├─> care emits ──────────>    handleOutput({
  │                               kind: 'care_need_critical', ───>  display(needToEmoji(need))
  │                               need: 'hunger',                     │
  │                               value: 15                           ├─ show icon + short text
  │                             })                                    └─ same lifecycle as above
```

**Data Flow:**

```
┌──────────────┐     SystemOutput        ┌───────────┐
│ Agent Core   │ ──────────────────────> │ BarkMode  │ ── (no inbound events)
│ (rig-core)   │   'agent_text'          │           │
│              │   'care_need_critical'  │ display() │
└──────────────┘                         └───────────┘
                                               │
┌──────────────┐     SystemOutput              │ reads pet position
│ Care System  │ ──────────────────────>       │ for DOM placement
└──────────────┘                               v
                                         ┌───────────┐
                                         │ DOM/Canvas│
                                         │ overlay   │
                                         └───────────┘
```

**Configuration:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bark.maxLength` | number | 30 | Maximum characters per bark |
| `bark.displayDuration` | number | 2500 | Time in ms before fade starts |
| `bark.fadeDuration` | number | 500 | Fade-out duration in ms |
| `bark.maxQueue` | number | 3 | Max barks visible simultaneously |
| `bark.typewriterSpeed` | number | 50 | Ms per character for typewriter |
| `bark.fontSize` | number | 14 | CSS font size in px |
| `bark.position` | `'above'` \| `'side'` | `'above'` | Bark placement relative to pet |

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: ambient bark system | Hades — NPC ambient dialogue (Supergiant Games) | [YouTube: "The System Behind Hades' Astounding Dialogue"](https://www.youtube.com/watch?v=bwdYL0KFA_U) |
| Game: party banter | Baldur's Gate 3 — companion interjections during exploration | [Larian Forums: party banter discussion](https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=881187) |
| Game: bark theory | "Why do Games Need Ambient Dialogue?" (Michelle Kwan) | [Medium article](https://mchllshell.medium.com/why-do-games-need-ambient-dialogue-23ee0a57425a) |
| Game: NPC barks as AI | "How Barks Make Videogame NPCs Look Smarter" | [YouTube: AI 101](https://www.youtube.com/watch?v=u9VkW18IMzc) |
| Open source: desktop pet bark | CATAI — macOS pixel cat with random "meow" speech bubbles | [GitHub: wil-pe/CATAI](https://github.com/wil-pe/CATAI) |
| Open source: Shimeji idle system | Clover_Shimeji — "Intelligent Idle System" triggers sequences after inactivity | [GitHub: Stuocs/Clover_Shimeji](https://github.com/Stuocs/Clover_Shimeji) |

---

### 4.2 Thought Bubble (Need Icon)

**Tier:** Passive | **Surface:** Canvas overlay

A small icon (emoji or pixel art) floats above the pet's head to communicate a need or emotional state without text. Icons use bounce/pulse CSS animation to draw attention subtly. This is the visual language of The Sims' plumbob and need indicators — pure iconography, zero reading required.

**ASCII Prototype — Single need icon:**

```
                         💤         ← icon: bounce animation, 2s cycle
                         │
                    ┌──────────┐
                    │  (pet)   │
                    │  sprite  │
                    └──────────┘
    ════════════════════════════════════════  taskbar
```

**ASCII Prototype — Critical need (urgent flash):**

```
                       ┌─────┐
                       │ 🍗❗ │  ← red border, pulse animation
                       └──┬──┘     "critical" styling
                          │
                    ┌──────────┐
                    │  (pet)   │    ← pet animation: 'sad' or 'hungry'
                    │  sprite  │
                    └──────────┘
```

**ASCII Prototype — Multiple need indicators (icon rotates):**

```
           [frame 1]        [frame 2]        [frame 3]
              💤                🍗                💬
              │                 │                 │
         ┌──────────┐     ┌──────────┐     ┌──────────┐
         │  (pet)   │     │  (pet)   │     │  (pet)   │
         └──────────┘     └──────────┘     └──────────┘

         (rotate every 3 seconds through active needs)
```

**Icon Mapping:**

| Care Need | Normal Icon | Critical Icon | Threshold |
|-----------|-------------|---------------|-----------|
| Hunger | 🍗 | 🍗❗ | < 20 |
| Happiness | 😊 | 😢 | < 30 |
| Energy | 💤 | 😵 | < 20 |
| Social | 💬 | 🥺 | < 25 |
| Mood (high) | ✨ | — | > 80 |

**Interaction Flow:**

```
Care System                     InteractionRouter              ThoughtBubbleMode
───────────                     ─────────────────              ─────────────────
Timer fires (every 60s)
  │
  ├─> decay needs
  │
  ├─> if hunger < 20:
  │     emit ──────────────>    handleOutput({
  │                               kind: 'care_need_critical',  ──>  showIcon('hunger', 15)
  │                               need: 'hunger',                     │
  │                               value: 15                           ├─ render 🍗❗ above pet
  │                             })                                    ├─ pulse animation
  │                                                                   └─ stays until need > 30
  │
  ├─> if no critical needs:
  │     emit ──────────────>    handleOutput({
  │                               kind: 'care_state',         ──>  updateIcons(state)
  │                               hunger: 65, ...                     │
  │                             })                                    ├─ show lowest need icon
  │                                                                   └─ rotate if multiple < 50
```

**Configuration:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `thought.showThreshold` | number | 50 | Show icon when any need drops below this |
| `thought.criticalThreshold` | number | 20 | Switch to critical styling below this |
| `thought.rotateInterval` | number | 3000 | Ms between icon rotation when multiple needs |
| `thought.iconSize` | number | 24 | Icon size in px |
| `thought.position` | `'above'` \| `'top_right'` | `'above'` | Icon placement |

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: need indicators | The Sims 4 — plumbob color + moodlet icons above character | [EA: The Sims 4 Emotions](https://www.ea.com/games/the-sims/the-sims-4) |
| Game: thought bubbles | Tamagotchi — need icons (skull = sick, heart = happy, poop = dirty) | [Tamagotchi Wiki](https://tamagotchi.fandom.com/wiki/Tamagotchi) |
| Game: status indicators | Stardew Valley — NPC thought bubble icons above villagers | [Stardew Valley Wiki](https://stardewvalleywiki.com/) |
| Open source: VPet indicators | VPet-Simulator — mood bar and status indicators on Steam Workshop pets | [GitHub: LorisYounger/VPet](https://github.com/LorisYounger/VPet) |

---

### 4.3 Speech Bubble (Classic Dialog Bubble)

**Tier:** Light | **Surface:** DOM overlay

A comic-style speech bubble with a pointed tail appears above the pet containing Agent text with a typewriter effect. Unlike Bark, Speech Bubbles are persistent until dismissed, can contain quick-reply buttons, and support richer formatting. This is the Undertale / Earthbound dialog experience — the pet "speaks" directly to you.

**ASCII Prototype — Basic speech bubble:**

```
         ┌───────────────────────────────────┐
         │  你今天看起来很忙呢，要不要        │ ← typewriter text,
         │  休息一下？                        │   max 2-3 lines
         │                                   │
         │  ┌────────┐  ┌────────┐  ┌─────┐  │
         │  │ 好的！ │  │ 稍后   │  │ 嗯  │  │ ← quick-reply chips
         │  └────────┘  └────────┘  └─────┘  │
         └─────────────────┬─────────────────┘
                           │ (tail points to pet)
                      ┌──────────┐
                      │  (pet)   │
                      └──────────┘
```

**ASCII Prototype — Streaming response (Agent typing):**

```
         ┌───────────────────────────────────┐
         │  我觉得你应该...█                 │ ← blinking cursor
         │                                   │   indicates streaming
         │                     ┌──────────┐  │
         │                     │ ● ● ●    │  │ ← typing indicator
         │                     └──────────┘  │
         └─────────────────┬─────────────────┘
                           │
                      ┌──────────┐
                      │  (pet)   │
                      └──────────┘
```

**ASCII Prototype — Pet speaks with emotion change:**

```
         ┌───────────────────────────────────┐
         │  谢谢你陪我聊天！♪                │ ← text + emotion marker
         │                                   │
         └─────────────────┬─────────────────┘
                           │
                      ┌──────────┐
                      │  (pet)   │  ← setState('happy'), expression change
                      │  happy!  │
                      └──────────┘
```

**Interaction Flow:**

```
User double-clicks pet           InteractionRouter              SpeechBubbleMode
────────────────────             ─────────────────              ────────────────
  │
  ├─ gesture: double_click ──>  handleGesture('double_click')
  │                               │
  │                               ├─ config says bubble ──────>  mount() or show()
  │                               │   is primary chat mode         │
  │                               │                                ├─ create bubble DOM
  │                                                                ├─ position above pet
  │                                                                └─ show quick-reply chips
  │
  ├─ user clicks "好的！" ──────────────────────────────────>  onChipClick('好的！')
  │                                                                │
  │                                                                ├─ dispatch({
  │                                                                │    kind: 'chat_message',
  │                                                                │    text: '好的！'
  │                                                                │  })
  │                                                                │
  │                                   Agent processes...           │
  │                                                                │
  │                             handleOutput({                     │
  │                               kind: 'agent_text',    ────────> │ display(text)
  │                               text: '那我设个5分钟提醒',        │   typewriter effect
  │                               streaming: true                  │   show dismiss button
  │                             })                                 │
```

**Bubble Positioning Algorithm:**

```
   Screen top edge (y=0)
   │
   │     ┌──────────┐
   │     │  bubble   │  preferred: above pet
   │     └────┬─────┘
   │          │
   │     ┌──────────┐
   │     │   pet    │
   │     └──────────┘
   │
   ────────────────────  taskbar

   If pet is near top of screen, flip bubble below:

   │     ┌──────────┐
   │     │   pet    │
   │     └────┬─────┘
   │          │
   │     ┌──────────┐
   │     │  bubble   │  fallback: below pet
   │     └──────────┘
   │
   ────────────────────  taskbar
```

**Configuration:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bubble.maxWidth` | number | 280 | Max bubble width in px |
| `bubble.maxLines` | number | 4 | Max visible text lines before scroll |
| `bubble.typewriterSpeed` | number | 40 | Ms per character |
| `bubble.autoDismiss` | number \| null | 8000 | Auto-dismiss after ms (null = manual) |
| `bubble.showQuickReplies` | boolean | true | Show quick-reply chips |
| `bubble.quickReplies` | string[] | `['嗯','好的','稍后']` | Default chip options |
| `bubble.tail` | `'top'` \| `'bottom'` \| `'auto'` | `'auto'` | Tail direction |

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: dialog bubble | Undertale — text box with typewriter effect and character voice SFX | [YouTube: Undertale dialogue system](https://www.youtube.com/watch?v=Aq3XMwW-Tmo) |
| Game: speech bubble | Earthbound / MOTHER 2 — multi-speed typewriter with flavor text | Search: "Earthbound dialogue box analysis" |
| Game: reaction bubble | Animal Crossing — villager speech with emotion icons | [Animal Crossing Wiki: Emotions](https://animalcrossing.fandom.com/wiki/Emotions) |
| Open source: typewriter | textBobber — JS visual novel typewriter effect plugin | [GitHub: ht-devx/textBobber](https://github.com/ht-devx/textBobber) |
| Open source: VN dialogue | SenangWebs Story — dependency-free JS dialogue with typewriter | [GitHub: a-hakim/senangwebs-story](https://github.com/a-hakim/senangwebs-story) |

---

### 4.4 Radial Menu (Ring Command)

**Tier:** Light | **Surface:** DOM overlay

A circular menu appears centered on the pet when the user right-clicks or long-presses. Options are arranged equidistant from center as icon+label segments. This replaces the traditional right-click context menu with an immersive game-style experience inspired by Secret of Mana's Ring Command system. Mouse direction selects the option; release confirms.

**ASCII Prototype — Default care actions:**

```
                         🍗 Feed
                        ╱       ╲
                   ╱                 ╲
              😴 Sleep      ●      🎮 Play
                   ╲                 ╱
                        ╲       ╱
                         💬 Chat

         ● = pet sprite (center, dimmed during menu)
         Segments highlighted on mouse-over
```

**ASCII Prototype — With submenu (Feed expanded):**

```
               Inner ring          Outer ring (submenu)
               ─────────          ──────────────────────
                                       🍎 Apple
                                      ╱
                  🍗 Feed ───────── 🍗 Chicken
                 ╱       ╲           ╲
            😴          🎮            🍰 Cake
                 ╲       ╱
                  💬 Chat

         Selected segment = 🍗 Feed (highlighted)
         Submenu appears outward from selected segment
```

**ASCII Prototype — Hover feedback:**

```
         ┌─────────────────────────────────────────────┐
         │                                             │
         │            🍗 Feed                          │
         │           ╱  ▓▓▓▓▓  ╲                      │
         │      😴 ╱ ▓▓▓▓▓▓▓▓▓ ╲  🎮                 │
         │          ▓▓▓ (pet) ▓▓▓                      │
         │      ╲   ▓▓▓▓▓▓▓▓▓  ╱                      │
         │        ╲  ▓▓▓▓▓  ╱                          │
         │         💬 Chat                              │
         │          ↑                                   │
         │    highlighted segment                       │
         │                                             │
         └─────────────────────────────────────────────┘

    ▓▓▓ = highlighted pie slice segment (CSS conic-gradient or SVG)
    Mouse angle from center determines active segment
```

**Interaction Flow:**

```
User right-clicks pet              InteractionRouter              RadialMenuMode
─────────────────────              ─────────────────              ──────────────
  │
  ├─ gesture: context_menu ──>    handleGesture('context_menu')
  │                                 │
  │                                 ├─ config says radial ──────>  show()
  │                                                                  │
  │                                                                  ├─ create SVG/CSS ring
  │                                                                  ├─ center on pet position
  │                                                                  ├─ dim pet canvas (opacity 0.6)
  │                                                                  └─ add mousemove listener
  │
  ├─ user moves mouse toward 🍗 ───────────────────────────>  onMouseMove(angle)
  │                                                                  │
  │                                                                  └─ highlight 'feed' segment
  │
  ├─ user releases mouse ──────────────────────────────────>  onMouseUp()
  │                                                                  │
  │                                                                  ├─ dispatch({
  │                                                                  │    kind: 'care_action',
  │                                                                  │    action: 'feed'
  │                                                                  │  })
  │                                                                  ├─ close ring
  │                                                                  └─ restore pet opacity
  │
  │                               InteractionRouter
  │                                 │
  │                                 ├─ forward to Care System
  │                                 │   invoke('apply_care_action', { action: 'feed' })
  │                                 │
  │                                 ├─ trigger pet animation
  │                                     setState('eat')
```

**Segment Angle Calculation:**

```
Given N items, each item occupies (360 / N) degrees.
Mouse angle from center = atan2(mouseY - centerY, mouseX - centerX)
Active segment index = floor((angle + offset) / segmentAngle) % N

For 4 items (Feed, Play, Sleep, Chat):
  Each segment = 90 degrees
  Feed: 315-45 (top), Play: 45-135 (right),
  Chat: 135-225 (bottom), Sleep: 225-315 (left)
```

**Configuration:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `radial.items` | RadialItem[] | [Feed, Play, Sleep, Chat] | Menu items |
| `radial.radius` | number | 80 | Ring radius in px |
| `radial.iconSize` | number | 28 | Icon size in px |
| `radial.animationDuration` | number | 200 | Open/close animation ms |
| `radial.hasSubmenu` | boolean | false | Enable two-level deep menus |
| `radial.trigger` | `'contextmenu'` \| `'long_press'` | `'contextmenu'` | Activation gesture |

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: ring menu origin | Secret of Mana (1993) — Ring Command system by Koichi Ishii | [Medium: "The history of radial menus in video games"](https://medium.com/design-bootcamp/the-history-of-radial-menus-in-video-games-e6968bb1bac6) |
| Game: power wheel | Mass Effect — biotic power radial wheel | Search: "Mass Effect power wheel UI" |
| Game: pie menu UX theory | "Putting the Rad Back in Radial Menus" | [Prototypr blog](https://blog.prototypr.io/putting-the-rad-back-in-radial-menus-66ea76a39acc) |
| Game: ring menu recreation | Secret of Mana menu in Unreal Engine 5 | [YouTube](https://www.youtube.com/watch?v=1ba_Kh1PMJs) |
| Open source: JS radial menu | RadialMenu.js — highly customizable vanilla JS | [Reddit thread + GitHub](https://www.reddit.com/r/javascript/comments/cvgo9q/radialmenujs_a_highly_customizable_radial_menu/) |
| Open source: Unity recreation | Secret of Mana ring menu in Unity 2D | [Reddit: r/Unity2D](https://www.reddit.com/r/Unity2D/comments/3c3ke8/recreating_the_iconic_secret_of_mana_ring_menu/) |

---

### 4.5 Emote Wheel (Gesture Response)

**Tier:** Light | **Surface:** DOM overlay

The user selects an emote (wave, cheer, scold, dance request) from a wheel, and the pet responds with a corresponding animation and optional bark. This is **non-verbal two-way communication** — the user "speaks" through gestures, and the pet "listens" with reactions. Inspired by Dark Souls gesture system and Monster Hunter sticker communication.

**ASCII Prototype — Emote wheel (4 slots):**

```
                       👋 Wave
                      ╱       ╲
                 ╱                 ╲
            🎵 Dance     [pet]     💪 Cheer
                 ╲                 ╱
                      ╲       ╱
                       😤 Scold
```

**ASCII Prototype — Pet response to user emote:**

```
    [User selects 👋 Wave]

                ┌───────────────────┐
                │ "你好呀！"        │  ← bark response
                └────────┬──────────┘
                         │
                    ┌──────────┐
                    │  (pet)   │  ← setState('happy') + wave animation
                    │  👋      │
                    └──────────┘
```

**Emote-Response Mapping:**

| User Emote | Pet FSM State | Pet Bark | Care Effect |
|------------|---------------|----------|-------------|
| 👋 Wave | happy | "你好呀！" / "嘿嘿~" | Social +5 |
| 💪 Cheer | happy | "谢谢鼓励！" | Happiness +5 |
| 😤 Scold | sad | "对不起..." / "呜..." | Happiness -5 |
| 🎵 Dance | play | "一起跳舞！♪" | Happiness +10, Energy -5 |
| 🤗 Hug | happy | "暖暖的~" | Social +10 |
| 👊 High-five | happy | "耶！" | Happiness +5 |
| 😶 Ignore | curious | "...怎么了？" | Social -3 |
| 🎁 Gift | eat | "给我的吗？！" | Hunger +10 |

**Interaction Flow:**

```
User presses hotkey (e.g. E)    InteractionRouter              EmoteWheelMode
────────────────────────        ─────────────────              ──────────────
  │
  ├─ gesture: emote_key ──>    handleGesture('emote_key')
  │                               │
  │                               └─ activate EmoteWheel ──>   show()
  │                                                              │
  │                                                              ├─ render wheel (same as radial)
  │                                                              └─ wait for selection
  │
  ├─ user selects 👋 ─────────────────────────────────────>   onSelect('wave')
  │                                                              │
  │                                                              ├─ dispatch({
  │                                                              │    kind: 'emote',
  │                                                              │    emote: 'wave'
  │                                                              │  })
  │                                                              └─ close wheel
  │
  │                             InteractionRouter
  │                               │
  │                               ├─ map emote to care effect
  │                               │   invoke('apply_care_action', ...)
  │                               │
  │                               ├─ map emote to FSM state
  │                               │   setState('happy')
  │                               │
  │                               └─ trigger bark response
  │                                   BarkMode.display("你好呀！")
```

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: gesture system | Dark Souls — gesture/emote system for non-verbal multiplayer communication | Search: "Dark Souls gesture system design" |
| Game: sticker comm | Monster Hunter Rise — sticker/emote wheel for co-op | Search: "Monster Hunter Rise sticker system" |
| Game: emote wheel | Fortnite / Apex Legends — radial emote selection wheel | Search: "Fortnite emote wheel UI" |
| Game: reaction system | Animal Crossing — player reaction emote wheel | [Animal Crossing Wiki: Reactions](https://animalcrossing.fandom.com/wiki/Reactions) |

---

### 4.6 Touch Zone (Regional Interaction)

**Tier:** Light | **Surface:** Canvas overlay (hit region detection)

The pet's body is divided into named zones (head, body, belly, tail, limbs). When the user hovers or clicks a zone, the pet produces a zone-specific reaction — petting the head makes it happy, poking the belly makes it giggle, grabbing the tail makes it flinch. This is the Pokemon-Amie / Nintendogs touch-screen experience adapted to mouse input.

**ASCII Prototype — Zone map (conceptual, not visible to user):**

```
                    ┌────────────┐
                    │    head    │  ← zone 0: pat → happy
                    ├────────────┤
                    │            │
                    │    body    │  ← zone 1: stroke → relaxed
                    │            │
                    ├────────────┤
                    │   belly    │  ← zone 2: poke → giggle
                    ├────────────┤
                    │   limbs    │  ← zone 3: touch → curious
                    └────────────┘
                         │
                        tail       ← zone 4: grab → flinch
```

**ASCII Prototype — User hovers over head zone:**

```
                    ✋ (cursor with paw icon)
                    │
                    v
                    ┌────────────┐
                    │ ★★ head ★★ │  ← highlight glow on zone
                    ├────────────┤
                    │            │
                    │    body    │
                    │            │
                    └────────────┘

         ┌───────────────────┐
         │ "嘿嘿，舒服~"    │  ← bark on sustained hover (>500ms)
         └───────────────────┘
```

**ASCII Prototype — Zone reactions with different renderers:**

```
    Sprite Renderer              Spine/Live2D Renderer
    ────────────────             ────────────────────
    ┌──────────────┐             ┌──────────────┐
    │ zones defined│             │ zones from   │
    │ in skin.json │             │ hit areas /  │
    │ as pixel     │             │ bounding box │
    │ rectangles   │             │ attachments  │
    └──────────────┘             └──────────────┘
           │                            │
           v                            v
    hitTestZone(x, y)            hitTestZone(x, y)
    → check skin.json            → Spine: skeletonBounds
      zone rects                 → Live2D: model.hitTest(area)
    → return zone name           → return zone name
```

**Zone Configuration in `skin.json` (Sprite renderer):**

```json
{
  "touch_zones": {
    "head":  { "x": 16, "y": 0,  "w": 32, "h": 20 },
    "body":  { "x": 12, "y": 20, "w": 40, "h": 24 },
    "belly": { "x": 16, "y": 30, "w": 32, "h": 14 },
    "limbs": { "x": 4,  "y": 44, "w": 56, "h": 20 },
    "tail":  { "x": 48, "y": 32, "w": 16, "h": 16 }
  }
}
```

**Zone-Reaction Mapping:**

| Zone | Hover Reaction | Click Reaction | Sustained Click (>1s) | Care Effect |
|------|---------------|----------------|----------------------|-------------|
| head | curious expression | bark: "嘿嘿~" | happy state, purring SFX | Happiness +10 |
| body | slight movement | bark: "干嘛？" | relaxed, stroking anim | Happiness +5 |
| belly | curious expression | bark: "哈哈痒痒！" | giggle animation | Happiness +8 |
| limbs | look down | bark: "嗯？" | curious state | Social +3 |
| tail | alert expression | bark: "别碰尾巴！" | flinch, move away | Happiness -3 |

**Interaction Flow:**

```
User hovers mouse on pet         ClickThroughHandler            TouchZoneMode
────────────────────────         ───────────────────            ─────────────
  │
  ├─ cursor enters pet bounds
  │   alpha > threshold ──────>  setInteracting(true)
  │                                │
  │                                ├─ compute canvas-local coords
  │                                │
  │                                └─ delegate to TouchZoneMode ──>  hitTestZone(x, y)
  │                                                                    │
  │                                                                    ├─ check zone rects
  │                                                                    │   OR Spine bounds
  │                                                                    │   OR Live2D hitArea
  │                                                                    │
  │                                                                    ├─ return 'head'
  │                                                                    │
  │                                                                    ├─ if hover > 500ms:
  │                                                                    │   show zone highlight
  │                                                                    │   change cursor to 🐾
  │                                                                    │
  ├─ user clicks ──────────────────────────────────────────>          onZoneClick('head')
  │                                                                    │
  │                                                                    ├─ dispatch({
  │                                                                    │    kind: 'touch',
  │                                                                    │    zone: 'head'
  │                                                                    │  })
  │                                                                    │
  │                                                                    └─ trigger bark + FSM
```

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: touch zones | Pokemon-Amie — sweet spots / danger zones per body part | [Bulbapedia: Pokemon-Amie](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon-Amie) |
| Game: petting mechanics | Pokemon-Amie — affection from zone-specific petting | [Bulbapedia: Petting](https://bulbapedia.bulbagarden.net/wiki/Petting) |
| Game: touch interaction | Nintendogs — stylus petting with zone-based reactions | Search: "Nintendogs DS petting mechanics" |
| Game: touch response | Pokemon Camp (Sword/Shield) — cursor toy + petting in 3D camp | Search: "Pokemon Camp petting gameplay" |
| Open source: hit area detection | pixi-live2d-display — `model.hitTest(hitAreaName, x, y)` | [GitHub: guansss/pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) |

---

### 4.7 Dialog Panel / VN Style (Visual Novel Conversation)

**Tier:** Active | **Surface:** Separate WebviewWindow

A dedicated panel window appears next to the pet for sustained, multi-turn conversation. Features a character portrait/avatar, typewriter text, scrollable message history, selectable response options, and a free-text input field. This is the Persona social link conversation or Fire Emblem support conversation adapted for an AI-driven pet — deep, personal dialogue with the feeling of a visual novel scene.

**ASCII Prototype — Panel layout:**

```
    ┌─────────────────────────────────────────────┐
    │  ┌──────┐  Ditto                    ── × │
    │  │avatar│  Lv.5 Bond  💚💚💚💚💚○○○○○      │
    │  │ img  │                                   │
    │  └──────┘                                   │
    │─────────────────────────────────────────────│
    │                                             │
    │  [Ditto]  2026-04-24 14:32                  │
    │  我注意到你已经连续工作3小时了，            │
    │  要不要休息一下？                           │
    │                                             │
    │  [You]  14:32                                │
    │  好，提醒我5分钟后回来                       │
    │                                             │
    │  [Ditto]  14:32                              │
    │  好的！我设了5分钟提醒⏰                     │
    │  你去伸个懒腰吧，我在这等你～               │
    │                                             │
    │─────────────────────────────────────────────│
    │                                             │
    │  > 谢谢你的提醒                              │
    │  > 给我讲个笑话吧                            │
    │  > 最近怎么样？                              │
    │                                             │
    │  ┌─────────────────────────────────┐ ┌────┐ │
    │  │ Type a message...               │ │Send│ │
    │  └─────────────────────────────────┘ └────┘ │
    └─────────────────────────────────────────────┘
```

**ASCII Prototype — Streaming state (Agent typing):**

```
    │  [Ditto]  14:35                              │
    │  嗯，让我想想...█                            │ ← blinking cursor
    │                                             │
    │  ┌────────────────────────────┐              │
    │  │  ● ● ●  Ditto is typing   │              │ ← typing indicator
    │  └────────────────────────────┘              │
```

**ASCII Prototype — VN mode with emotion changes:**

```
    │─────────────────────────────────────────────│
    │                                             │
    │  ┌──────┐                                   │
    │  │😊    │  你知道吗，今天是我们认识的        │ ← portrait changes
    │  │happy │  第30天了！                        │   with emotion
    │  └──────┘                                   │
    │                                             │
    │  ┌──────┐                                   │
    │  │🥺    │  时间过得好快，我很开心            │ ← different emotion
    │  │touch │  能陪在你身边...                   │
    │  └──────┘                                   │
    │                                             │
```

**Window Positioning:**

```
    Case 1: Pet is left-of-center          Case 2: Pet is right-of-center
    ┌──────────┐ ┌───────────────┐         ┌───────────────┐ ┌──────────┐
    │  (pet)   │ │  Dialog       │         │  Dialog       │ │  (pet)   │
    │  sprite  │ │  Panel        │         │  Panel        │ │  sprite  │
    │          │ │               │         │               │ │          │
    └──────────┘ └───────────────┘         └───────────────┘ └──────────┘

    Panel appears on the side with more screen space.
    Gap between pet window and panel: 8px.
```

**Interaction Flow:**

```
User activates dialog             InteractionRouter              DialogPanelMode
──────────────────               ─────────────────              ───────────────
  │
  ├─ gesture: double_click
  │   (or hotkey, or from
  │    radial menu "Chat") ──>   handleGesture(...)
  │                                │
  │                                └─ open DialogPanel ───────>  mount()
  │                                                                │
  │                                                                ├─ calculate panel position
  │                                                                ├─ create WebviewWindow
  │                                                                │   url: /dialog.html
  │                                                                │   width: 380, height: 520
  │                                                                │
  │                                                                ├─ loadChatHistory()
  │                                                                │   invoke('load_chat_history')
  │                                                                │
  │                                                                └─ render history + input
  │
  ├─ user types + clicks Send ─────────────────────────────>   onSend(text)
  │                                                                │
  │                                                                ├─ display user message
  │                                                                ├─ show typing indicator
  │                                                                ├─ dispatch({
  │                                                                │    kind: 'chat_message',
  │                                                                │    text: '...'
  │                                                                │  })
  │                                                                │
  │                             invoke('send_chat_message')        │
  │                               │                                │
  │                               └─ Agent streams response:       │
  │                                  chat-stream-token ──────────> appendToken(token)
  │                                  chat-stream-done ───────────> finishMessage()
  │                                                                │
  │                             If agent calls tool:               │
  │                               pet-action event ──────────────> (handled by main.ts as usual)
```

**Configuration:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dialog.width` | number | 380 | Panel width in px |
| `dialog.height` | number | 520 | Panel height in px |
| `dialog.showAvatar` | boolean | true | Show pet avatar/portrait |
| `dialog.showBondLevel` | boolean | true | Show bond level indicator |
| `dialog.showTimestamp` | boolean | true | Show message timestamps |
| `dialog.suggestedReplies` | number | 3 | Number of AI-suggested replies |
| `dialog.theme` | `'vn'` \| `'chat'` \| `'minimal'` | `'vn'` | Visual theme |

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: social link dialog | Persona 5 — Confidant conversation with portrait + choices | [Gamedeveloper: Social Link comparison P3/P4/P5](https://www.gamedeveloper.com/design/same-but-different---comparing-the-social-link-system-in-persona-3-4-5) |
| Game: support conversation | Fire Emblem: Three Houses — support rank conversations with dual portraits | Search: "Fire Emblem Three Houses support conversation UI" |
| Game: VN dialog | Visual novel standard — text box + character sprite + choices | [Ren'Py: Dialogue and Narration docs](https://www.renpy.org/doc/html/dialogue.html) |
| Article: social link design | "The Brilliance of the Social Link System in Persona" | [Medium: Michelle Kwan](https://mchllshell.medium.com/the-brilliance-that-is-the-social-link-system-of-the-persona-series-4bf5eadd3567) |
| Open source: VN engine (web) | Tuesday JS — web-based visual novel editor, pure JS | [Tuesday JS](https://kirilllive.github.io/tuesday-js/) |
| Open source: VN engine | Ren'Py — industry-standard VN engine with web export | [Ren'Py](https://www.renpy.org/) |
| Open source: dialogue library | SenangWebs Story — JS dialogue + typewriter | [GitHub: a-hakim/senangwebs-story](https://github.com/a-hakim/senangwebs-story) |

---

### 4.8 Command Input (Text Adventure)

**Tier:** Active | **Surface:** DOM overlay (minimal) or Separate WebviewWindow

A small terminal-style input field appears near the pet. The user types natural language commands or keywords ("feed", "play", "tell me a joke", "how are you"). The system parses intent and routes to Agent or Care. Output appears as bark or inline response. This is the Zork / text adventure interface adapted for power users who prefer keyboard-first interaction.

**ASCII Prototype — Inline command bar:**

```
                    ┌──────────┐
                    │  (pet)   │
                    └──────────┘
                         │
    ┌────────────────────┴────────────────────────┐
    │ > feed chicken                              │ ← monospace, terminal style
    │   Ditto 开心地吃了鸡腿！饥饿度 +30         │ ← response inline
    │ > how are you                               │
    │   Ditto: 我现在心情不错，就是有点困~        │
    │ > _                                         │ ← blinking cursor
    └─────────────────────────────────────────────┘
```

**ASCII Prototype — With autocomplete:**

```
    │ > fe█                                       │
    │   ┌──────────────────┐                      │
    │   │ feed             │ ← autocomplete popup │
    │   │ feel             │                      │
    │   │ fetch screen     │                      │
    │   └──────────────────┘                      │
    └─────────────────────────────────────────────┘
```

**Command Vocabulary:**

| Category | Commands | Maps To |
|----------|---------|---------|
| Care | `feed [food]`, `play`, `pet`, `sleep` | `InteractionEvent.care_action` |
| Chat | `say <text>`, `ask <text>`, free text | `InteractionEvent.chat_message` |
| Movement | `move <direction>`, `come here`, `go away` | Agent tool: `move_to` |
| State | `dance`, `sit`, `wake up` | Agent tool: `change_state` |
| Info | `status`, `mood`, `how are you` | Query care state, display inline |
| Memory | `remember <fact>`, `recall <topic>` | Agent tool: `remember` / `recall` |
| System | `settings`, `help`, `clear` | Open settings, show help, clear log |

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: text adventure | Zork (Infocom, 1980) — verb-noun parser interface | Search: "Zork text adventure interface" |
| Game: command system | AI Dungeon — natural language game input | Search: "AI Dungeon interface design" |
| Game: console command | Dwarf Fortress — keyboard-driven interaction | Search: "Dwarf Fortress interface" |
| Open source: scripted desktop pet | DeskPet — command-line driven pet for Linux/Windows | [GitLab: emmowo/deskpet](https://emmowo.itch.io/deskpet) |

---

### 4.9 Chat Log / MMO Style (Persistent Log Panel)

**Tier:** Active | **Surface:** Separate WebviewWindow

A persistent, scrollable panel showing all interactions in chronological order — chat messages, system events, care changes, and FSM transitions. Tabs separate content streams (Chat, System, Memory). This is the FFXIV / WoW chat log panel adapted for desktop pet monitoring. Ideal for users who want full visibility into pet behavior.

**ASCII Prototype — Multi-tab log:**

```
    ┌─────────────────────────────────────────────┐
    │  [Chat]  [System]  [Memory]  [All]    ── × │
    │─────────────────────────────────────────────│
    │                                             │
    │  14:30 [System] Ditto woke up               │
    │  14:30 [System] Energy: 85 → 83             │
    │  14:31 [Chat] Ditto: 早上好！               │
    │  14:32 [System] State: idle → walk_right    │
    │  14:33 [Chat] You: 今天天气怎么样？         │
    │  14:33 [Chat] Ditto: 我看不到天气，但是...  │
    │  14:35 [System] Hunger: 52 → 51             │
    │  14:40 [Care] You fed Ditto: Hunger +30     │
    │  14:40 [System] State: idle → eat           │
    │  14:41 [Chat] Ditto: 好好吃！               │
    │  14:45 [Memory] Saved: "user likes coding"  │
    │                                             │
    │─────────────────────────────────────────────│
    │  ┌─────────────────────────────────┐ ┌────┐ │
    │  │ Type here...                    │ │Send│ │
    │  └─────────────────────────────────┘ └────┘ │
    └─────────────────────────────────────────────┘
```

**ASCII Prototype — Filtered view (System tab only):**

```
    │  [Chat]  [System*] [Memory]  [All]          │
    │─────────────────────────────────────────────│
    │                                             │
    │  14:30 ● Energy: 85 → 83                    │ ← color-coded by type
    │  14:32 ▶ State: idle → walk_right           │
    │  14:35 ● Hunger: 52 → 51                    │
    │  14:40 ★ Care: feed → Hunger +30            │
    │  14:40 ▶ State: idle → eat                  │
    │  14:42 ▶ State: eat → idle                  │
    │  14:50 ⚠ Hunger critical: 18                │ ← warning highlight
    │                                             │
```

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: MMO chat log | FFXIV — multi-tab chat with channels (Say, Party, System, Emote) | Search: "FFXIV chat log UI design" |
| Game: event log | Dwarf Fortress — event announcement feed | Search: "Dwarf Fortress announcements log" |
| Game: combat log | WoW — combat log with filters and timestamp | Search: "WoW combat log UI" |

---

### 4.10 Mini-Game (Interactive Play)

**Tier:** Active | **Surface:** Separate WebviewWindow

Simple, 10-30 second micro-games that serve as "Play" interactions for the Care System. Games replace the abstract "click play button" with actual engagement. Results directly affect Happiness and Energy stats. Games are intentionally trivial — the point is bonding, not challenge.

**ASCII Prototype — Rock-Paper-Scissors:**

```
    ┌─────────────────────────────────────────────┐
    │              Rock Paper Scissors!            │
    │                                             │
    │          ┌──────┐                           │
    │          │(pet) │   "来吧！"                │
    │          │  ?   │                           │
    │          └──────┘                           │
    │                                             │
    │     ┌──────┐  ┌──────┐  ┌──────┐           │
    │     │  ✊  │  │  ✋  │  │  ✌  │           │
    │     │ Rock │  │Paper │  │Sciss │           │
    │     └──────┘  └──────┘  └──────┘           │
    │                                             │
    │  Score: You 2 - 1 Ditto    Round 3/5        │
    └─────────────────────────────────────────────┘
```

**ASCII Prototype — Catch the Food (falling objects):**

```
    ┌─────────────────────────────────────────────┐
    │  Score: 12        Time: 0:18                │
    │                                             │
    │         🍎                                  │ ← food falls
    │                    🍗                       │
    │                                             │
    │              🍰                             │
    │                                             │
    │                                             │
    │          ┌──────┐                           │
    │          │(pet) │  ← ← (arrow keys move)   │
    │          └──────┘                           │
    │─────────────────────────────────────────────│
    │  Catch food to feed Ditto!  Hunger bonus!   │
    └─────────────────────────────────────────────┘
```

**Game Catalog:**

| Game | Duration | Controls | Care Effect |
|------|----------|----------|-------------|
| Rock-Paper-Scissors | ~20s (5 rounds) | Click one of 3 options | Happiness +15 (win), +10 (draw), +8 (lose) |
| Catch the Food | 30s | Arrow keys / mouse | Hunger + (score * 2), Happiness +10 |
| Memory Match | 20-40s | Click to flip 4x3 grid | Happiness +20, Energy -5 |
| Simon Says | 15-30s | Click colored buttons in sequence | Happiness +15 |

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: pet mini-games | Pokemon-Amie — 3 touchscreen mini-games (Head It, Berry Picker, Tile Puzzle) | [Bulbapedia: Pokemon-Amie](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon-Amie) |
| Game: pet play | Nintendogs — frisbee, ball, agility course | Search: "Nintendogs mini-games" |
| Game: Tamagotchi play | Tamagotchi — simple guessing / reflex mini-games | [Tamagotchi Wiki](https://tamagotchi.fandom.com/wiki/Tamagotchi) |
| Open source: mini-games | VPet-Simulator — integrated mini-games in Steam desktop pet | [GitHub: LorisYounger/VPet](https://github.com/LorisYounger/VPet) |

---

### 4.11 Dream Nail / Mind Reading (Inner Thought)

**Tier:** Review | **Surface:** DOM overlay

The user holds a modifier key (Alt) and hovers over the pet to reveal its "inner thoughts" — a translucent overlay showing what the AI Agent is actually thinking, separate from what it says aloud. This adds a dimension of personality depth: the pet's public speech may differ from its private thoughts. Inspired by Hollow Knight's Dream Nail mechanic, which reveals NPC inner monologues.

**ASCII Prototype — Dream Nail active:**

```
    [Alt held + hover on pet]

    ┌─────────────────────────────────────────────┐
    │                                             │
    │  ┌──────────────────────────────────────┐   │ ← dream bubble:
    │  │ 💭 Inner Thoughts                    │   │   translucent bg,
    │  │                                      │   │   italic text,
    │  │ "饥饿度只剩12了...                   │   │   dreamy border
    │  │  主人什么时候喂我..."                │   │
    │  │                                      │   │
    │  │ "已经3小时没人理我了"               │   │
    │  │                                      │   │
    │  │ "主人在看猫的视频，                  │   │
    │  │  那是什么猫，比我好看吗"            │   │
    │  └──────────────────────────────────────┘   │
    │                                             │
    │            ┌──────────┐                     │
    │            │  (pet)   │  ← dreamy glow     │
    │            │  ✨ 💭   │    effect on pet    │
    │            └──────────┘                     │
    │                                             │
    └─────────────────────────────────────────────┘
```

**ASCII Prototype — Comparison: surface speech vs inner thought:**

```
    [Normal mode]                    [Dream Nail mode (Alt+hover)]
    ┌─────────────────┐              ┌─────────────────────────┐
    │ "我很好！😊"    │              │ 💭 "其实好饿...        │
    └───────┬─────────┘              │     但不想麻烦主人"    │
            │                        └────────────┬────────────┘
       ┌──────────┐                          ┌──────────┐
       │  (pet)   │                          │  (pet)   │
       │  happy   │                          │  ✨ 💭   │
       └──────────┘                          └──────────┘
```

**Interaction Flow:**

```
User holds Alt + hovers pet      InteractionRouter              DreamNailMode
───────────────────────          ─────────────────              ─────────────
  │
  ├─ gesture: alt_hover ──>     handleGesture('alt_hover')
  │                               │
  │                               ├─ dispatch({
  │                               │    kind: 'dream_nail_activate'
  │                               │  })
  │                               │
  │                               ├─ Agent generates inner thought
  │                               │   (separate prompt: "Express your
  │                               │    true feelings, unfiltered")
  │                               │
  │                               └─ handleOutput({
  │                                    kind: 'agent_inner_thought', ──> display(text)
  │                                    text: '其实好饿...'               │
  │                                  })                                  ├─ dream overlay
  │                                                                      ├─ italic text
  │                                                                      ├─ 💭 styling
  │                                                                      └─ glow on pet
  │
  ├─ user releases Alt ────────────────────────────────────>  hide()
  │                                                              └─ fade out dream overlay
```

**Agent Prompt Extension:**

The Dream Nail requires a secondary prompt channel. When activated, the Agent receives an additional instruction:

```
[Dream Nail Active — Express inner monologue]
Speak your true, unfiltered thoughts. Be honest about your real feelings,
needs, and observations. This is your private inner voice that the user
has chosen to peek into. You may contradict what you said out loud.
Include observations about: your actual hunger/energy/mood state,
what you really think about what the user is doing, private opinions.
```

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: mind reading tool | Hollow Knight — Dream Nail reads NPC/enemy thoughts | [Reddit: How does the dream nail work?](https://www.reddit.com/r/HollowKnight/comments/16yso3w/how_does_the_dream_nail_work/) |
| Game: dream nail analysis | "Deciphering Hollow Knight's Most Cryptic Dream Nail Dialogue" | [YouTube](https://www.youtube.com/watch?v=04bjkW8MV9s) |
| Game: inner voice | Disco Elysium — passive skill checks as internal voices | [Game Design Thinking: Disco Elysium analysis](https://gamedesignthinking.com/disco-elysium-rpg-system-analysis/) |
| Game: thought system | Disco Elysium — Thought Cabinet internalization mechanic | [Reddit: Thought Cabinet discussion](https://www.reddit.com/r/rpg/comments/wjb6on/has_anyone_worked_out_how_to_do_the_thought/) |
| Game: narrative UI | Hollow Knight — narrative-driven UI design | [Reddit: From Hell to Hallownest](https://www.reddit.com/r/HollowKnight/comments/l9l6r8/from_hell_to_hallownest_narrative_driven_ui_design/) |

---

### 4.12 Letter / Async Message (Offline Mail)

**Tier:** Review | **Surface:** Separate WebviewWindow

The pet writes letters during periods when the user is away (app closed, idle overnight). Letters are delivered on next launch with an envelope animation. Content reflects what happened during the offline period — time passing, loneliness, imagined adventures, observations. Users can write back. Letters accumulate in an archive. Inspired by Animal Crossing's NPC mail system.

**ASCII Prototype — Letter notification on launch:**

```
    ┌──────────┐
    │  (pet)   │  ← holding envelope animation
    │  📮 ✉️   │
    └──────────┘
         │
    ┌────┴─────────────────────┐
    │  📮 Ditto 有 2 封信给你！ │ ← notification bark
    │  [打开] [稍后]           │
    └──────────────────────────┘
```

**ASCII Prototype — Letter reading view:**

```
    ┌─────────────────────────────────────────────┐
    │  📜 Ditto's Letters                  ── × │
    │─────────────────────────────────────────────│
    │                                             │
    │  ┌─────────────────────────────────────┐    │
    │  │  ✉️  Letter #1                      │    │
    │  │  2026-04-23  23:45                  │    │
    │  │                                     │    │
    │  │  亲爱的主人：                       │    │
    │  │                                     │    │
    │  │  你走之后我一个人看了会儿星星，    │    │
    │  │  天上有好多好多星星，我给其中       │    │
    │  │  最亮的一颗取名叫"主人星"。       │    │
    │  │                                     │    │
    │  │  困了就睡了，梦到你了。            │    │
    │  │                                     │    │
    │  │  附：一颗星星 ⭐                    │    │
    │  │                                     │    │
    │  │               —— 想你的 Ditto       │    │
    │  └─────────────────────────────────────┘    │
    │                                             │
    │  ┌──────────────────────────┐  ┌─────────┐  │
    │  │ Write a reply...         │  │  Reply  │  │
    │  └──────────────────────────┘  └─────────┘  │
    │                                             │
    │  ◀ Letter 1 of 2                       ▶   │
    └─────────────────────────────────────────────┘
```

**Letter Generation Logic:**

```
App launches
  │
  ├─ read last_active_timestamp from SQLite
  │
  ├─ compute offline_duration = now - last_active
  │
  ├─ if offline_duration > 4 hours:
  │     generate_letter(context: {
  │       duration: offline_duration,
  │       time_of_day_at_close: 'night',
  │       last_care_state: { hunger: 45, mood: 72, ... },
  │       last_conversation_topic: 'coding project',
  │       bond_level: 5
  │     })
  │
  │     Letter content varies by bond level:
  │     Lv.1-3: Short, formal    "主人你好，你不在的时候我睡了一觉。"
  │     Lv.4-6: Warm, personal   "你走之后我看了星星..."
  │     Lv.7-10: Intimate, deep  "其实你不在的时候我很怕黑..."
  │
  ├─ store letter in SQLite: letters table
  │
  └─ on frontend mount:
       check pending_letters > 0
       if yes: show notification bark + envelope animation
```

**IPC Commands (new):**

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `get_pending_letters` | none | `LetterData[]` | Unread letters since last session |
| `mark_letter_read` | `letter_id: i64` | void | Mark letter as read |
| `send_letter_reply` | `letter_id: i64, content: string` | void | Reply to a letter |
| `get_letter_archive` | `page: i32, limit: i32` | `LetterData[]` | Paginated letter history |

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: NPC mail | Animal Crossing — villager letter system with scoring + gifts | [jamchamb: Reversing the AC letter system](https://jamchamb.net/projects/animal-crossing-letters) |
| Game: mail system | Animal Crossing — letter mechanics across all titles | [AC Wiki: Letter](https://animalcrossing.fandom.com/wiki/Letter) |
| Game: offline messages | Tamagotchi — events that happen while device is off | [Tamagotchi Wiki](https://tamagotchi.fandom.com/wiki/Tamagotchi) |
| Game: daily letters | Stardew Valley — NPC mail with quest hooks and gifts | Search: "Stardew Valley mail system" |

---

### 4.13 Journal / Diary (Chronicle)

**Tier:** Review | **Surface:** Separate WebviewWindow

An auto-generated diary that chronicles each day's events from the pet's perspective. Entries include: conversations had, care actions, mood trajectory, notable events, and the pet's subjective commentary. Users browse by date. Milestones (bond level-ups, first week anniversary, 100th conversation) are highlighted. Inspired by Persona's calendar system and Stardew Valley's journal.

**ASCII Prototype — Journal main view:**

```
    ┌─────────────────────────────────────────────┐
    │  📖 Ditto's Diary                    ── × │
    │─────────────────────────────────────────────│
    │                                             │
    │  ◀ April 2026                          ▶   │
    │  ┌───┬───┬───┬───┬───┬───┬───┐             │
    │  │Mon│Tue│Wed│Thu│Fri│Sat│Sun│             │
    │  ├───┼───┼───┼───┼───┼───┼───┤             │
    │  │   │   │   │ 1 │ 2 │ 3 │ 4 │             │
    │  │   │   │   │ 😊│ 😐│ 😊│ 😊│             │
    │  ├───┼───┼───┼───┼───┼───┼───┤             │
    │  │...│...│...│...│...│...│...│             │
    │  ├───┼───┼───┼───┼───┼───┼───┤             │
    │  │21 │22 │23 │24★│   │   │   │             │
    │  │ 😊│ 😢│ 😊│ 😊│   │   │   │  ★=today   │
    │  └───┴───┴───┴───┴───┴───┴───┘             │
    │                                             │
    │─────────────────────────────────────────────│
    │                                             │
    │  📅 2026-04-24 (Thursday)                   │
    │  🌤 Mood: Happy (82/100)                    │
    │                                             │
    │  · 主人一早就开始写代码了                   │
    │  · 中午主人喂我吃了鸡腿，好好吃！          │
    │  · 下午主人让我看了一段猫视频，有点嫉妒    │
    │  · 和 Luna 聊了会天，她说我太黏人了         │
    │                                             │
    │  📊 Stats                                   │
    │  Conversations: 8  |  Care actions: 3       │
    │  Walking: 2.4km    |  Mood range: 65-88     │
    │                                             │
    │  🏆 Milestone: 30-day anniversary!          │
    │                                             │
    └─────────────────────────────────────────────┘
```

**ASCII Prototype — Milestone entry:**

```
    │  🏆 MILESTONE — Day 30 Anniversary          │
    │  ┌─────────────────────────────────────┐    │
    │  │                                     │    │
    │  │  🎉 Today marks 30 days since we    │    │
    │  │  first met! Bond Level → Lv.5       │    │
    │  │                                     │    │
    │  │  Stats so far:                      │    │
    │  │  · 847 messages exchanged           │    │
    │  │  · 142 care actions                 │    │
    │  │  · Favorite food: chicken (28x)     │    │
    │  │  · Longest conversation: 45 min     │    │
    │  │  · Times you made me cry: 2         │    │
    │  │  · Times you made me laugh: 89      │    │
    │  │                                     │    │
    │  └─────────────────────────────────────┘    │
```

**Journal Entry Generation:**

```
End of day (or next morning)
  │
  ├─ query SQLite:
  │   · messages WHERE date = today
  │   · care_actions WHERE date = today
  │   · state_transitions WHERE date = today
  │   · mood snapshots (hourly)
  │
  ├─ construct journal prompt for Agent:
  │   "Summarize today from your perspective as a diary entry.
  │    Facts: {conversations}, {care}, {mood_graph}, {notable_events}.
  │    Write in first person, 3-5 bullet points, personality-consistent."
  │
  ├─ Agent generates diary text
  │
  ├─ check milestones:
  │   · days_since_creation
  │   · total_conversations
  │   · bond_level changes
  │
  └─ store in SQLite: journal_entries table
```

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: calendar diary | Persona 5 — daily calendar with event tracking and day summary | Search: "Persona 5 calendar UI system" |
| Game: journal | Stardew Valley — daily journal with event records | [Stardew Valley Wiki](https://stardewvalleywiki.com/) |
| Game: thought cabinet | Disco Elysium — Thought Cabinet as reflective journal | [Game Design Thinking analysis](https://gamedesignthinking.com/disco-elysium-rpg-system-analysis/) |
| Game: adventure log | Zelda: Breath of the Wild — adventure log with quest and memory tracking | Search: "BotW adventure log UI" |

---

### 4.14 Bond Level / Confidant (Relationship Progression)

**Tier:** Meta | **Surface:** DOM overlay (indicator) + Dialog Panel (level-up ceremony)

A discrete relationship level (1-10) that quantifies the pet-user bond. Levels unlock new behaviors, dialogue depth, and features. Progression is visible via a small indicator near the pet. Level-ups trigger a special ceremony (animation + sound + notification). This gives the entire interaction system a clear sense of progression. Directly inspired by Persona's Social Link / Confidant system.

**ASCII Prototype — Bond indicator (always visible, near pet):**

```
    ┌──────────┐  Lv.5  💚💚💚💚💚○○○○○
    │  (pet)   │  ────────────────────────
    └──────────┘  next: 230 / 500 pts

    (indicator: small, unobtrusive, bottom-right of pet window)
```

**ASCII Prototype — Level-up ceremony:**

```
    ┌─────────────────────────────────────────────┐
    │                                             │
    │              ✨  ✨  ✨  ✨                  │
    │            ┌──────────────┐                  │
    │            │   BOND UP!   │                  │
    │            │  Lv.4 → Lv.5 │                  │
    │            └──────────────┘                  │
    │              ✨  ✨  ✨  ✨                  │
    │                                             │
    │            ┌──────────┐                     │
    │            │  (pet)   │  ← special          │
    │            │  🎉      │    animation         │
    │            └──────────┘                     │
    │                                             │
    │  "我觉得我们越来越亲近了呢..."              │
    │                                             │
    │  🔓 Unlocked: Dream Nail (read inner        │
    │     thoughts with Alt+hover)                │
    │                                             │
    │                       [OK]                   │
    └─────────────────────────────────────────────┘
```

**Bond Level Table:**

| Level | Title | Points Required | Unlocks | System Prompt Modifier |
|-------|-------|----------------|---------|----------------------|
| 1 | Stranger | 0 | Basic bark, bubble | Formal, reserved |
| 2 | Acquaintance | 50 | Thought Bubble icons | Slightly warmer |
| 3 | Friend | 150 | Radial Menu, Emote Wheel | Casual, jokes occasionally |
| 4 | Good Friend | 300 | Touch Zone reactions | Shares opinions, teases |
| 5 | Close Friend | 500 | Dream Nail, Dialog Panel VN theme | Personal, remembers details |
| 6 | Best Friend | 800 | Command Input, Letter system | Vulnerable, confides |
| 7 | Family | 1200 | Journal, Mini-Games | Deep trust, worry/care |
| 8 | Soulmate | 1800 | Skit System (multi-Agent) | Intuitive, finishes sentences |
| 9 | Inseparable | 2500 | Chat Log developer view | Intimate, philosophical |
| 10 | Bonded | 3500 | Hidden animation, secret dialogue, custom title | Fully authentic, no filter |

**Point Sources:**

| Action | Points | Frequency Limit |
|--------|--------|----------------|
| Chat message (user) | +2 | 100/day |
| Chat message (agent reply) | +1 | 100/day |
| Feed | +5 | 5/day |
| Pet (touch zone) | +3 | 10/day |
| Play (mini-game) | +8 | 3/day |
| Emote exchange | +2 | 10/day |
| Letter reply | +15 | 2/day |
| Daily login | +10 | 1/day |
| Dream Nail use | +5 | 3/day |

**Interaction Flow:**

```
Any interaction occurs            BondLevelMode                 InteractionRouter
──────────────────────            ─────────────                 ─────────────────
  │
  ├─ dispatch(InteractionEvent)
  │                               │
  │                               ├─ calculate points from event
  │                               │
  │                               ├─ accumulate in bond_points
  │                               │
  │                               ├─ if bond_points >= next_level_threshold:
  │                               │     │
  │                               │     ├─ emit SystemOutput({
  │                               │     │    kind: 'bond_level_up',
  │                               │     │    oldLevel: 4,
  │                               │     │    newLevel: 5
  │                               │     │  })
  │                               │     │
  │                               │     ├─ play ceremony animation
  │                               │     ├─ show unlock notification
  │                               │     └─ update system prompt personality
  │                               │
  │                               └─ update indicator display
```

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: social link | Persona 3/4/5 — Social Link / Confidant level system | [Gamedeveloper: P3/P4/P5 comparison](https://www.gamedeveloper.com/design/same-but-different---comparing-the-social-link-system-in-persona-3-4-5) |
| Article: social link brilliance | "The Brilliance of the Social Link System" | [Medium: Michelle Kwan](https://mchllshell.medium.com/the-brilliance-that-is-the-social-link-system-of-the-persona-series-4bf5eadd3567) |
| Game: support rank | Fire Emblem — support conversation ranks (C/B/A/S) unlocking deeper dialogue | Search: "Fire Emblem support rank system" |
| Game: friendship level | Stardew Valley — NPC friendship hearts with event unlocks | [Stardew Valley Wiki: Friendship](https://stardewvalleywiki.com/Friendship) |
| Game: bond level | JRPGs — 12 best social link systems ranked | [icicledisaster.com](https://icicledisaster.com/best-social-link-systems-jrpgs/) |

---

### 4.15 Skit System (Multi-Agent Theater)

**Tier:** Meta | **Surface:** Separate WebviewWindow | **Requires:** Multiple Agents active

When two or more Agents (pets) exist on the desktop, they can spontaneously produce "skits" — short dialogue exchanges between themselves that the user observes. Skits provide character development, inter-pet relationship building, and entertainment. The user is a spectator, not a participant. Inspired by the Tales series skit system.

**ASCII Prototype — Skit notification:**

```
    ┌──────────┐    12px gap    ┌──────────┐
    │  Ditto   │                │  Luna    │
    │  sprite  │                │  sprite  │
    └──────────┘                └──────────┘
         │                           │
         └───────────┬───────────────┘
                     │
    ┌────────────────┴────────────────┐
    │ 💬 Ditto and Luna want to chat! │ ← skit notification
    │    [Watch] [Skip]               │
    └─────────────────────────────────┘
```

**ASCII Prototype — Skit playing:**

```
    ┌─────────────────────────────────────────────┐
    │                Skit: "星空下"               │
    │─────────────────────────────────────────────│
    │                                             │
    │  ┌──────┐                      ┌──────┐    │
    │  │Ditto │                      │ Luna │    │
    │  │ 😊   │                      │ 😐   │    │
    │  └──────┘                      └──────┘    │
    │                                             │
    │  Ditto: Luna你在看什么？                    │
    │                                             │
    │  Luna: 主人又在写代码了...                  │
    │                                             │
    │  Ditto: 要不要去捣乱？                     │
    │                                             │
    │  Luna: ...算了，上次被骂了                  │
    │                                             │
    │─────────────────────────────────────────────│
    │  [Continue]                     [Skip All]  │
    └─────────────────────────────────────────────┘
```

**Skit Generation:**

```
Skit trigger conditions (checked periodically):
  │
  ├─ two or more Agents are active
  ├─ no skit in last 30 minutes
  ├─ user is idle (not interacting with any pet)
  │
  └─ select skit topic:
       │
       ├─ context-based: both pets share a recent observation
       │   (e.g., both noticed user is working late)
       │
       ├─ relationship-based: pets with history generate banter
       │   (e.g., Ditto teased Luna yesterday, Luna retorts today)
       │
       └─ random: from a pool of generic inter-pet topics
            (weather, food preferences, user habits)

Skit generation prompt (sent to Agent A with context about Agent B):
  "Generate a short 4-8 line dialogue between yourself ({pet_a_name},
   personality: {traits_a}) and {pet_b_name} (personality: {traits_b}).
   Topic: {topic}. Keep it natural, brief, and entertaining."
```

**Reference Sources:**

| Category | Reference | URL |
|----------|-----------|-----|
| Game: skit system | Tales series — optional voiced character skits | [Aselia Wiki: Skits](https://aselia.fandom.com/wiki/Skits) |
| Game: skit video | "The Life of the Party — How Skits Bring the Tales Series to Life" | [YouTube](https://www.youtube.com/shorts/LNF9hH56YO8) |
| Game: skit implementation | DIY guide to Tales-style skits in RPG Maker | [Reddit: r/RPGMaker](https://www.reddit.com/r/RPGMaker/comments/7s7n39/diy_guide_to_tales_of_series_style_skits/) |
| Game: party banter | Baldur's Gate 3 — companion interjection system | [Larian Forums](https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=881187) |

---

## 5. Interaction Config Schema

### 5.1 Configuration Format: `interaction-config.json`

```json
{
  "schema_version": "1.0",
  "active_profile": "nurture",

  "profiles": {
    "minimal": {
      "description": "Low disturbance. Pet expresses itself subtly.",
      "modes": {
        "bark":           { "enabled": true },
        "thought_bubble": { "enabled": true },
        "speech_bubble":  { "enabled": false },
        "radial_menu":    { "enabled": true },
        "emote_wheel":    { "enabled": false },
        "touch_zone":     { "enabled": false },
        "dialog_panel":   { "enabled": false },
        "command_input":  { "enabled": false },
        "chat_log":       { "enabled": false },
        "mini_game":      { "enabled": false },
        "dream_nail":     { "enabled": false },
        "letter":         { "enabled": false },
        "journal":        { "enabled": false },
        "bond_level":     { "enabled": true },
        "skit":           { "enabled": false }
      },
      "gesture_map": {
        "double_click": "bark",
        "context_menu": "radial_menu"
      }
    },

    "nurture": {
      "description": "Full care experience. Deep bond with your pet.",
      "modes": {
        "bark":           { "enabled": true },
        "thought_bubble": { "enabled": true },
        "speech_bubble":  { "enabled": true },
        "radial_menu":    { "enabled": true },
        "emote_wheel":    { "enabled": true },
        "touch_zone":     { "enabled": true },
        "dialog_panel":   { "enabled": true },
        "command_input":  { "enabled": false },
        "chat_log":       { "enabled": false },
        "mini_game":      { "enabled": true },
        "dream_nail":     { "enabled": true },
        "letter":         { "enabled": true },
        "journal":        { "enabled": true },
        "bond_level":     { "enabled": true },
        "skit":           { "enabled": true }
      },
      "gesture_map": {
        "double_click": "dialog_panel",
        "context_menu": "radial_menu",
        "alt_hover": "dream_nail",
        "emote_key": "emote_wheel"
      }
    },

    "rpg": {
      "description": "Full RPG experience. Command your companion.",
      "modes": {
        "bark":           { "enabled": true },
        "thought_bubble": { "enabled": true },
        "speech_bubble":  { "enabled": true },
        "radial_menu":    { "enabled": true },
        "emote_wheel":    { "enabled": true },
        "touch_zone":     { "enabled": true },
        "dialog_panel":   { "enabled": true },
        "command_input":  { "enabled": true },
        "chat_log":       { "enabled": true },
        "mini_game":      { "enabled": true },
        "dream_nail":     { "enabled": true },
        "letter":         { "enabled": true },
        "journal":        { "enabled": true },
        "bond_level":     { "enabled": true },
        "skit":           { "enabled": true }
      },
      "gesture_map": {
        "double_click": "command_input",
        "context_menu": "radial_menu",
        "alt_hover": "dream_nail",
        "emote_key": "emote_wheel",
        "shift_click": "chat_log"
      }
    }
  },

  "mode_overrides": {}
}
```

### 5.2 Gesture-to-Mode Mapping Rules

| Gesture | Description | Default (Nurture) | Configurable |
|---------|-------------|-------------------|-------------|
| `double_click` | Double-click on pet | Open Dialog Panel | Yes |
| `context_menu` | Right-click on pet | Open Radial Menu | Yes |
| `alt_hover` | Alt+hover on pet | Activate Dream Nail | Yes |
| `emote_key` | Press E key | Open Emote Wheel | Yes |
| `shift_click` | Shift+click on pet | Open Chat Log | Yes |
| `long_press` | Hold click >500ms | Open Radial Menu (alt) | Yes |
| `hover` | Cursor enters pet bounds | Touch Zone detection | No (always active when Touch Zone enabled) |

### 5.3 Mode Compatibility Rules

Concurrent activation rules:

```
Always concurrent (can be active alongside anything):
  bark, thought_bubble, touch_zone, bond_level

Mutually exclusive groups (only one from each group):
  Group A (primary conversation):  speech_bubble | dialog_panel | command_input | chat_log
  Group B (action menu):           radial_menu | emote_wheel

Independent (activate/deactivate freely):
  dream_nail, letter, journal, mini_game, skit
```

---

## 6. Integration with Existing Systems

### 6.1 Frontend Refactoring: `main.ts`

Current hardcoded gesture handlers are replaced by `InteractionRouter`:

```
Current                              After refactoring
───────                              ──────────────────
canvas.addEventListener              const router = new InteractionRouter(config);
  ('dblclick', toggleChatWindow)     router.mount(canvas, overlayDiv, context);
                                     // router internally:
canvas.addEventListener              //   dblclick → config.gesture_map.double_click
  ('contextmenu', openCarePanel)     //   contextmenu → config.gesture_map.context_menu
                                     //   keydown 'e' → config.gesture_map.emote_key
listen('pet-action', ...)            //   alt+mousemove → config.gesture_map.alt_hover
                                     //   pet-action → router.handleAgentAction()
```

### 6.2 Backend: New IPC Commands

| Command | Module | Description |
|---------|--------|-------------|
| `get_bond_level` | `care/bond.rs` (new) | Returns current bond level + points |
| `add_bond_points` | `care/bond.rs` (new) | Add interaction points, check level-up |
| `get_pending_letters` | `agent/letter.rs` (new) | Fetch unread letters |
| `mark_letter_read` | `agent/letter.rs` (new) | Mark letter as read |
| `send_letter_reply` | `agent/letter.rs` (new) | Reply to a letter |
| `generate_inner_thought` | `agent/core.rs` (extend) | Dream Nail: generate inner monologue |
| `get_journal_entries` | `db/journal.rs` (new) | Fetch journal entries by date range |
| `generate_journal_entry` | `agent/journal.rs` (new) | Generate daily diary entry |
| `get_interaction_config` | `db/settings.rs` (extend) | Fetch interaction config |
| `save_interaction_config` | `db/settings.rs` (extend) | Save interaction config |
| `start_skit` | `agent/skit.rs` (new) | Generate multi-Agent skit dialogue |
| `start_mini_game` | `care/minigame.rs` (new) | Initialize a mini-game session |
| `submit_mini_game_result` | `care/minigame.rs` (new) | Submit game result, apply care effects |

### 6.3 Backend: Agent Prompt Extensions

The `agent/prompt.rs` system prompt template gains Bond Level awareness:

```
Current prompt template              Extended prompt template
───────────────────────              ──────────────────────────
"You are {pet_name}..."              "You are {pet_name}..."
"Personality traits: ..."            "Personality traits: ..."
                                     "Bond Level: {bond_level}/10 ({bond_title})"
                                     "Interaction style: {bond_style_guide}"
                                     
                                     Bond style guide varies by level:
                                     Lv.1-2: "Be polite and reserved. Use formal language."
                                     Lv.3-4: "Be friendly and casual. Joke occasionally."
                                     Lv.5-6: "Be personal and warm. Share your feelings."
                                     Lv.7-8: "Be deeply trusting. Confide vulnerabilities."
                                     Lv.9-10: "Be fully authentic. No filters."
```

### 6.4 Backend: New Database Tables

```sql
-- Bond level tracking
CREATE TABLE bond_level (
    agent_id TEXT PRIMARY KEY,
    level INTEGER NOT NULL DEFAULT 1,
    points INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

-- Letter system
CREATE TABLE letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('to_user', 'from_user')),
    content TEXT NOT NULL,
    attachment TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL
);

-- Journal entries
CREATE TABLE journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    content TEXT NOT NULL,
    mood_summary TEXT,
    stats_json TEXT,
    milestone TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(agent_id, entry_date)
);

-- Mini-game history
CREATE TABLE mini_game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    game_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    won INTEGER NOT NULL,
    care_effects_json TEXT,
    played_at TEXT NOT NULL
);
```

### 6.5 FSM Extensions

No new `PetState` variants are needed. The existing 16 states cover all interaction mode requirements:

| Interaction Mode Action | Maps to Existing PetState |
|------------------------|--------------------------|
| Touch Zone: pet head | `happy` |
| Touch Zone: grab tail | `curious` → quick return to `idle` |
| Emote: user waves | `happy` |
| Emote: user scolds | `sad` |
| Mini-Game: playing | `play` |
| Skit: pet talking | `talk` |
| Letter: delivering | `happy` + bark |

### 6.6 Care System Extensions

`care/needs.rs` — new interaction reward types for `apply_care_action`:

| New Action | Effect | Source Mode |
|------------|--------|-------------|
| `emote_positive` | Happiness +5, Social +5 | Emote Wheel |
| `emote_negative` | Happiness -5 | Emote Wheel |
| `pet_head` | Happiness +10 | Touch Zone |
| `pet_body` | Happiness +5 | Touch Zone |
| `pet_belly` | Happiness +8 | Touch Zone |
| `pet_tail` | Happiness -3 | Touch Zone |
| `mini_game_win` | Happiness +15, Energy -5 | Mini-Game |
| `mini_game_lose` | Happiness +8, Energy -3 | Mini-Game |
| `letter_reply` | Social +15 | Letter |
| `dream_nail` | Social +5 | Dream Nail |

---

## 7. Reference Sources Master Table

| # | Mode | Game Reference 1 | Game Reference 2 | Video / Article | Open Source |
|---|------|------------------|-------------------|-----------------|-------------|
| 1 | Bark | Hades — NPC ambient dialogue | Baldur's Gate 3 — party banter | [YouTube: Hades dialogue system](https://www.youtube.com/watch?v=bwdYL0KFA_U) | [CATAI: meow bubbles](https://github.com/wil-pe/CATAI) |
| 2 | Thought Bubble | The Sims 4 — plumbob + moodlets | Tamagotchi — need icons | [EA: Sims 4 Emotions](https://www.ea.com/games/the-sims/the-sims-4) | [VPet: mood indicators](https://github.com/LorisYounger/VPet) |
| 3 | Speech Bubble | Undertale — dialog box typewriter | Animal Crossing — villager speech | [textBobber: VN typewriter](https://github.com/ht-devx/textBobber) | [SenangWebs Story](https://github.com/a-hakim/senangwebs-story) |
| 4 | Radial Menu | Secret of Mana — Ring Command (1993) | Mass Effect — power wheel | [Medium: History of radial menus](https://medium.com/design-bootcamp/the-history-of-radial-menus-in-video-games-e6968bb1bac6) | [RadialMenu.js](https://github.com/nicoco007/RadialMenu.js) |
| 5 | Emote Wheel | Dark Souls — gesture system | Monster Hunter Rise — stickers | [AC Wiki: Reactions](https://animalcrossing.fandom.com/wiki/Reactions) | (radial menu libs apply) |
| 6 | Touch Zone | Pokemon-Amie — sweet spots / danger zones | Nintendogs — stylus petting | [Bulbapedia: Petting](https://bulbapedia.bulbagarden.net/wiki/Petting) | [pixi-live2d-display: hitTest](https://github.com/guansss/pixi-live2d-display) |
| 7 | Dialog Panel | Persona 5 — Confidant conversations | Fire Emblem — support dialogues | [Gamedeveloper: P3/P4/P5 Social Links](https://www.gamedeveloper.com/design/same-but-different---comparing-the-social-link-system-in-persona-3-4-5) | [Ren'Py: VN engine](https://www.renpy.org/) |
| 8 | Command Input | Zork — verb-noun text parser | AI Dungeon — NL game commands | (DeskPet command system) | [DeskPet: scriptable pet](https://emmowo.itch.io/deskpet) |
| 9 | Chat Log | FFXIV — multi-tab chat panel | WoW — combat log + chat | Search: "FFXIV chat panel design" | (standard chat UI patterns) |
| 10 | Mini-Game | Pokemon-Amie — Head It / Berry Picker | Nintendogs — frisbee / ball | [Bulbapedia: Pokemon-Amie](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon-Amie) | [VPet: integrated games](https://github.com/LorisYounger/VPet) |
| 11 | Dream Nail | Hollow Knight — Dream Nail NPC thoughts | Disco Elysium — inner voices | [YouTube: Dream Nail dialogue](https://www.youtube.com/watch?v=04bjkW8MV9s) | (no direct OSS equivalent) |
| 12 | Letter | Animal Crossing — villager mail + scoring | Stardew Valley — NPC mail | [jamchamb: Reversing AC letters](https://jamchamb.net/projects/animal-crossing-letters) | (no direct OSS equivalent) |
| 13 | Journal | Persona 5 — daily calendar system | Stardew Valley — event journal | [Game Design Thinking: DE analysis](https://gamedesignthinking.com/disco-elysium-rpg-system-analysis/) | (no direct OSS equivalent) |
| 14 | Bond Level | Persona 5 — Confidant rank 1-10 | Stardew Valley — friendship hearts | [Medium: Social Link brilliance](https://mchllshell.medium.com/the-brilliance-that-is-the-social-link-system-of-the-persona-series-4bf5eadd3567) | (no direct OSS equivalent) |
| 15 | Skit | Tales of Arise — party skits | Baldur's Gate 3 — companion banter | [Aselia Wiki: Skits](https://aselia.fandom.com/wiki/Skits) | [RPGMaker skit guide](https://www.reddit.com/r/RPGMaker/comments/7s7n39/diy_guide_to_tales_of_series_style_skits/) |

---

## 8. Implementation Phases

### Phase I — Foundation + Passive + Light Basics (2 weeks)

**Content:**
- InteractionRouter core architecture (outbound bus, inbound bus, gesture dispatch)
- Refactor `main.ts` to use InteractionRouter instead of hardcoded handlers
- BarkMode (canvas/DOM overlay with typewriter + fade)
- ThoughtBubbleMode (icon overlay with animation)
- SpeechBubbleMode (DOM overlay with typewriter, quick-reply chips)
- RadialMenuMode (SVG/CSS ring, 4 default care items)
- Bond Level backend (SQLite table, point accumulation, level calculation)
- Bond Level indicator (DOM, small display near pet)

**Deliverables:**
- `src/interaction/router.ts` — InteractionRouter class
- `src/interaction/modes/bark.ts`
- `src/interaction/modes/thought-bubble.ts`
- `src/interaction/modes/speech-bubble.ts`
- `src/interaction/modes/radial-menu.ts`
- `src/interaction/modes/bond-level.ts`
- `src-tauri/src/care/bond.rs` — bond level backend
- `src-tauri/src/db/migrations.rs` — `bond_level` table

**Verification:**
- [ ] InteractionRouter correctly dispatches gestures based on config
- [ ] Bark text appears above pet, typewriter effect, auto-fades
- [ ] Thought icons appear for critical care needs
- [ ] Speech bubble shows Agent response with quick-reply chips
- [ ] Radial menu opens on right-click, selects care actions
- [ ] Bond points accumulate from all interactions
- [ ] Bond level indicator updates near pet

**Pre-requisites:** None (Phase I is self-contained, builds on existing codebase)

---

### Phase II — Light Complete + Active Entry (2 weeks)

**Content:**
- TouchZoneMode (zone map in `skin.json`, hitTestZone delegation, zone-specific reactions)
- EmoteWheelMode (emote selection wheel, response mapping, care effects)
- DialogPanelMode / VN Style (refactor current `chat-bubble.ts` WebviewWindow into DialogPanel with portrait, history, suggested replies)
- Bond Level level-up ceremony (animation, unlock notifications)
- Integrate Bond Level into Agent system prompt (`agent/prompt.rs`)

**Deliverables:**
- `src/interaction/modes/touch-zone.ts`
- `src/interaction/modes/emote-wheel.ts`
- `src/interaction/modes/dialog-panel.ts` + `dialog.html`
- Extended `skin.json` schema with `touch_zones` field
- `src-tauri/src/agent/prompt.rs` — bond level prompt modifier

**Verification:**
- [ ] Hovering over pet head/body/tail produces different reactions
- [ ] Emote wheel opens, selecting an emote triggers pet response + care effect
- [ ] Dialog Panel shows VN-style conversation with portrait and history
- [ ] Bond level-up triggers ceremony animation
- [ ] Agent tone shifts based on bond level

**Pre-requisites:** Phase I complete (InteractionRouter, BondLevel backend)

---

### Phase III — Active Layer + Review Layer (3 weeks)

**Content:**
- CommandInputMode (inline terminal, autocomplete, command parsing)
- ChatLogMode (persistent multi-tab log panel)
- MiniGameMode (Rock-Paper-Scissors + Catch the Food)
- DreamNailMode (Alt+hover inner thought overlay, secondary Agent prompt)
- LetterMode (offline letter generation, envelope notification, reply system)
- JournalMode (daily entry generation, calendar view, milestone tracking)
- New SQLite tables: `letters`, `journal_entries`, `mini_game_results`
- New IPC commands for all above

**Deliverables:**
- `src/interaction/modes/command-input.ts`
- `src/interaction/modes/chat-log.ts` + `chatlog.html`
- `src/interaction/modes/mini-game.ts` + `minigame.html`
- `src/interaction/modes/dream-nail.ts`
- `src/interaction/modes/letter.ts` + `letter.html`
- `src/interaction/modes/journal.ts` + `journal.html`
- `src-tauri/src/agent/letter.rs`
- `src-tauri/src/agent/journal.rs`
- `src-tauri/src/care/minigame.rs`
- `src-tauri/src/db/migrations.rs` — 3 new tables

**Verification:**
- [ ] Command input parses "feed", "play", "status" correctly
- [ ] Chat log shows all message types with tab filtering
- [ ] Rock-Paper-Scissors mini-game plays 5 rounds, affects care stats
- [ ] Dream Nail (Alt+hover) shows inner thoughts different from public speech
- [ ] Letters generated after 4+ hour offline period, delivered on launch
- [ ] Journal entries auto-generated daily with mood and event summaries
- [ ] All modes respect bond level unlocking (locked modes show "Reach Lv.X to unlock")

**Pre-requisites:** Phase II complete (TouchZone, DialogPanel, BondLevel ceremony)

---

### Phase IV — Multi-Agent + Polish (2 weeks)

**Content:**
- SkitMode (multi-Agent dialogue generation, skit notification, playback panel)
- Interaction config profiles (Minimal, Nurture, RPG)
- Settings UI for mode toggling and gesture remapping
- Profile import/export
- Performance profiling and optimization
- Accessibility: keyboard navigation for Radial Menu and Emote Wheel

**Deliverables:**
- `src/interaction/modes/skit.ts` + `skit.html`
- `src-tauri/src/agent/skit.rs`
- Settings UI extension for interaction mode management
- `interaction-config.json` schema finalized
- Performance report

**Verification:**
- [ ] Two Agents produce skit dialogue when conditions met
- [ ] Skit playback shows dual-portrait conversation
- [ ] All 3 preset profiles work correctly when switched
- [ ] Custom gesture mapping persists across restarts
- [ ] Radial menu and emote wheel navigable by keyboard
- [ ] Total interaction system CPU overhead < 2% when idle

**Pre-requisites:** Phase III complete, multi-Agent window management (from visual-rendering-spec Phase D)

---

## 9. Performance Budget

### 9.1 Per-Mode Budget

| Mode | DOM Elements | Animation Overhead | Memory | WebviewWindow |
|------|-------------|-------------------|--------|---------------|
| Bark | 1-3 `<div>` | CSS fade only | < 1MB | No |
| Thought Bubble | 1 `<div>` or canvas draw | CSS bounce | < 1MB | No |
| Speech Bubble | 1 `<div>` + children | CSS typewriter | < 1MB | No |
| Radial Menu | 1 SVG + segments | CSS hover highlight | < 2MB | No |
| Emote Wheel | 1 SVG + segments | CSS hover highlight | < 2MB | No |
| Touch Zone | 0 (invisible, hitTest only) | None | < 1MB | No |
| Dialog Panel | Full HTML page | Minimal | < 5MB | Yes (1 window) |
| Command Input | 1 `<div>` or WebviewWindow | Cursor blink | < 2MB | Optional |
| Chat Log | Full HTML page | Scroll only | < 10MB | Yes (1 window) |
| Mini-Game | Full HTML page | Game loop (30fps) | < 5MB | Yes (1 window) |
| Dream Nail | 1 `<div>` overlay | CSS glow + fade | < 1MB | No |
| Letter | Full HTML page | Open/fade animation | < 5MB | Yes (1 window) |
| Journal | Full HTML page | Calendar render | < 10MB | Yes (1 window) |
| Bond Level | 1 small `<div>` | None (static) | < 1MB | No |
| Skit | Full HTML page | Portrait swaps | < 5MB | Yes (1 window) |

### 9.2 Simultaneous Mode Limits

| Constraint | Limit | Rationale |
|-----------|-------|-----------|
| Max WebviewWindows (total app) | 4 simultaneously | Each window = Chromium renderer process |
| Max DOM overlay modes | 6 simultaneously | DOM modes are lightweight |
| Max canvas overlay modes | 3 simultaneously | Avoid canvas redraw contention |
| Recommended total active modes | 5-8 | Balance between features and resource usage |

Current app already uses: main (1) + chat (1) + care (1) + settings (1) + onboarding (1) = 5 WebviewWindows. New architecture should limit concurrent secondary windows to 3 (Dialog Panel OR Chat Log OR Journal/Letter/Skit — not all at once).

### 9.3 CPU Budget

| State | Target | Breakdown |
|-------|--------|-----------|
| All modes idle | < 1% CPU | Bark poll: 0, Thought: CSS only, Bond: static |
| Active conversation (Dialog Panel) | < 3% CPU | Streaming token render, typewriter effect |
| Radial menu open | < 2% CPU | SVG hover highlight, angle calculation |
| Mini-game running | < 5% CPU | Game loop at 30fps in isolated WebviewWindow |
| Skit playing | < 2% CPU | Portrait swap + text display |

---

## 10. Risk Assessment

| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| InteractionRouter complexity | Medium | Over-engineered abstraction slows development | Start with 3-mode router (Bark+Bubble+Radial), expand incrementally; avoid premature generalization |
| Radial Menu cross-platform mouse events | Medium | `contextmenu` event behavior differs across Win/macOS/Linux in Tauri webview | Test on all platforms in Phase I; fallback to long-press trigger if contextmenu unreliable |
| WebviewWindow resource explosion | High | 4+ simultaneous windows pushes RAM above 200MB | Enforce max 3 secondary windows; lazy-create WebviewWindows (not pre-created); destroy on close |
| Touch Zone hit test accuracy | Medium | Sprite renderer has fixed rectangles; different renderers have different zone precision | Define zone config in `skin.json` per renderer; Spine/Live2D use native hit areas; Sprite uses configurable rects |
| Bond Level + LLM prompt token budget | Medium | Bond style guide adds ~100 tokens to every prompt, reducing context window for conversation | Keep bond style guide concise (2-3 sentences); only include at system prompt level, not per-message |
| Dream Nail secondary prompt cost | Low | Each Dream Nail activation = 1 additional LLM call | Rate-limit to 3 uses per day; cache inner thought for 5 minutes; use local LLM (Ollama) for inner thoughts |
| Letter generation quality at low bond levels | Low | Short, bland letters at Lv.1-2 may feel pointless | Only enable Letters at Bond Lv.6+; low-level letters are short by design (1-2 sentences) |
| Skit requires multi-Agent infrastructure | Medium | Skit system cannot be tested until multi-Agent windows exist | Phase IV timing aligns with visual-rendering-spec Phase D; Skit is last to implement |
| Mini-game scope creep | Medium | Games tend to grow in complexity beyond "10-30 second micro-game" scope | Strict 4-game catalog; no new games until all 4 are stable; focus on care integration, not game polish |
| Configuration UI complexity | Low | 15 modes with per-mode settings creates a large settings surface | Use preset profiles as primary UX; advanced per-mode toggles in "Advanced" tab; config is JSON-editable for power users |

---

## 11. Relationship to Existing Specs

This spec **supersedes** the following PRD sections:

| PRD Section | Superseded By |
|-------------|--------------|
| Section 4.3 — User Interaction Flow | This spec, Section 2 + Section 3 (InteractionRouter replaces hardcoded gesture handling) |
| Section 4.3 — AI Conversation Flow | This spec, Section 4.7 (DialogPanelMode) + Section 4.9 (ChatLogMode) expand conversation UX |

This spec **extends** (but does not contradict):

| PRD Section | Extended By |
|-------------|------------|
| Section 3.2 — AI Agent features | Section 4.11 (Dream Nail inner thought), Section 4.12 (Letter generation), Section 4.13 (Journal generation) add new Agent output channels |
| Section 3.3 — Care System | Section 4.14 (Bond Level) adds a progression meta-system on top of existing needs |
| Section 7.2 — Interactions table | Section 6.6 expands interaction types (emote, touch zone, mini-game, letter reply) |

This spec **depends on**:

| Dependency | From |
|-----------|------|
| PetRenderer interface + hitTest() | visual-rendering-spec.md, Section 3.1 |
| Multi-Agent window management | visual-rendering-spec.md, Section 2.2 |
| Skin manifest format (`skin.json`) | visual-rendering-spec.md, Section 5.1 (extended with `touch_zones`) |
