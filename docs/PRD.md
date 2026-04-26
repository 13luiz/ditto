# Ditto — Agent-Driven Desktop Pet PRD

> **Version:** 2.0
> **Date:** 2026-04-26
> **Status:** Design Approved
> **Platforms:** Windows 10+ (x64), macOS 12+ (Universal). Linux x64 added in v0.4.0.
> **Supersedes:** PRD v1.0 (2026-04-21). Incorporates `docs/visual-rendering-spec.md` and `docs/interaction-modes-spec.md` as canonical architecture.

---

## 1. Vision

Ditto is a desktop companion built with **Rust + Tauri v2**. A small animated creature lives on your desktop — walking, climbing, sleeping, expressing needs. Behind the pet is an AI Agent that can hold conversations, perceive your screen, remember past interactions, and develop a personality over time.

Ditto holds three identities at once:

- **An agent's body.** The pet is a face for the AI. Long-term, that AI can be a real work agent (via OpenClaw integration), running tasks across the user's tools while keeping the lightweight, ambient feel of a desktop pet.
- **A cozy companion.** The pet has needs, moods, a bond level that grows with care, letters it writes when you're away, a journal it keeps about its life with you. The companionship is the product, not a side feature.
- **A skin platform.** Multiple rendering backends (sprite, skeletal, Live2D, 3D) coexist behind one runtime, so users can replace the visual layer without losing their pet's memory, personality, or progress. The skin is a projection of state, not the state itself.

**Tagline:** A living companion on your desktop, powered by AI.

The original v1.0 vision ("an Agent-driven desktop pet") still holds. v2.0 of the PRD widens the lens: Ditto is no longer just *a pet that uses AI*, it is *the visible, lovable surface of an AI that can be as deep as the user wants*.

---

## 2. Target Users

Ditto serves a broader audience than the v1.0 PRD assumed. Four primary personas:

| Persona | What they want |
|---------|----------------|
| **Knowledge workers / developers** | A non-intrusive AI companion that quietly lives at the edge of the desktop, available for chat, notifications, and (eventually) real work tasks via OpenClaw. |
| **Cozy gamers / collectors** | A Tamagotchi/Persona-style relationship simulator — care, bond level, letters, journal, mini-games. They want depth that rewards consistent presence. |
| **VTuber / Live2D community** | A way to bring their own Live2D, VRM, or Spine models to life on the desktop without writing code. Ditto runs the model; they bring the art. |
| **Workshop creators** | Hobbyists and game artists who want to ship character skins through community channels. They need the file format to be simple enough to author and stable enough to invest in. |

All four can coexist on a single product because the architecture decouples *body* (skin/renderer), *mind* (agent backend), *behavior* (interaction modes), and *care* (needs/bond). Any user can dial each axis independently.

---

## 3. Foundations Shipped in v0.1.0

The v1.0 PRD's 5-phase plan is **complete** and shipped as v0.1.0. The current product already provides:

- Transparent, always-on-top, frameless overlay window with sprite-sheet rendering, animation state machine, physics (gravity, ground detection, screen boundary clamp), cursor proximity reactions, grab-and-drag, and 16-state FSM for behavior.
- AI agent via `rig-core` with multi-provider LLM support (OpenAI, Anthropic, Ollama), streaming responses, tool calling, short-term sliding-window + long-term key-value memory, personality engine with shifting traits, and rule-based fallback for offline/error scenarios.
- Care system with hunger/happiness/energy/social needs decay, mood calculation, care actions (feed/pet/play/chat/sleep), and behavior scheduler for proactive triggers (morning greeting, break reminders).
- System integration: tray icon with show/hide/settings/quit menu, auto-launch registration, settings UI for LLM config and pet name, first-run onboarding wizard, custom theme discovery, screen capture for context, performance profiling.
- Packaging: Windows MSI/NSIS installers, macOS DMG, Tauri auto-updater, ~30MB RAM at idle, < 5% CPU.
- 222 tests passing, clippy clean, fmt clean, CI on every push.
- Frontend migrated to Vue 3 with router, composables, Pinia stores, and a UI windows app shell.

The rest of this PRD describes what comes next — v0.2.0 through v0.6.0 — building on this baseline.

---

## 4. Core Architecture

### 4.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| App framework | **Tauri v2** | Transparent window, multi-window, system tray, cross-platform, 3-10MB binary |
| Backend language | **Rust** | Performance, safety, Tauri native |
| Async runtime | **tokio** 1.x | Async LLM streaming, WebSocket client, scheduler |
| AI agent framework | **rig-core** 0.35+ | Built-in agent (BuiltinAgent backend); 20+ LLM providers; tool calling; streaming |
| External agent | **OpenClaw** (via WebSocket) | ExternalAgentChannel backend; v0.4.0+; Ditto registers as a ChannelPlugin |
| Local LLM runtime | **Ollama** (HTTP API) | Local model option for BuiltinAgent |
| Database | **rusqlite** 0.32+ (bundled SQLite) | Conversations, memory, care state, bond level, letters, journal, settings |
| Sprite rendering | **Canvas 2D** | Default renderer; reliable, transparent, low overhead |
| Skeletal rendering | **@esotericsoftware/spine-canvas** (v0.2.0) / **spine-pixi** (v0.3.0+ if needed) | Skeletal animation backend |
| Live2D rendering | **PixiJS v6** + **pixi-live2d-display** + Cubism Core (v0.3.0) | VTuber-grade animation backend |
| 3D rendering (optional) | **Three.js** + **@pixiv/three-vrm** (post v0.6.0) | VRM avatar backend |
| Vector animation (optional) | **@lottiefiles/dotlottie-web** (post v0.6.0) | Lightweight Lottie backend |
| Frontend framework | **Vue 3** + **vue-router** + **Pinia** | UI windows; DOM-overlay modes (Vue micro-app on overlay) |
| Build | **Vite** 6 | Frontend build, chunk splitting |
| System tray | Tauri built-in `tray-icon` | Cross-platform system tray |
| Screen capture | **xcap** 0.6+ | Multi-monitor primary screen capture |
| Auto-launch | **auto-launch** 0.6+ | OS startup registration |
| Time | **chrono** 0.4+ | Time-of-day, idle detection, scheduled triggers |
| Tests | `cargo test` (unit + integration) + **rstest** 0.18 (parameterized) | 222+ tests today, growing |

**Removed from v1.0 PRD:** SolidJS (Vue chosen instead in v0.1.0). `rdev` (deferred; click-through stays polling-based until evidence of need).

### 4.2 System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Ditto App (Tauri v2)                        │
│                                                                     │
│  ┌─────────────────── Backend (Rust) ──────────────────────────┐   │
│  │                                                               │   │
│  │  AgentBackend trait                                           │   │
│  │   ├── BuiltinAgent (rig-core; OpenAI/Anthropic/Ollama)        │   │
│  │   └── ExternalAgentChannel (WebSocket to OpenClaw Gateway)    │   │
│  │                                                               │   │
│  │  Pet Behavior  │  Care + Bond  │  Memory     │  System         │   │
│  │   FSM (16)     │   Needs       │   Short-term│   Tray          │   │
│  │   Movement     │   Mood        │   Long-term │   Auto-launch   │   │
│  │   Physics      │   Bond engine │   Letters   │   Screen capture│   │
│  │   Cursor       │   Time-trigger│   Journal   │   Skin discovery│   │
│  │   Scheduler    │   Care actions│             │                 │   │
│  │                                                               │   │
│  │  Database (SQLite)                                            │   │
│  │   conversations · messages · memory · personality             │   │
│  │   settings · care_state · bond_level · letters · journal      │   │
│  │   skin_active_per_agent · interaction_config                  │   │
│  │                                                               │   │
│  │  Tauri IPC commands  +  Event bus  (broadcast::Sender)        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Frontend windows:                                                  │
│                                                                     │
│  ┌───── overlay.html (per pet) ─────┐  ┌─── pet-manager.html ──┐    │
│  │ Transparent, always-on-top        │  │ Vue SPA (one window)  │    │
│  │                                   │  │                       │    │
│  │ Vanilla TS:                       │  │ Routes:               │    │
│  │   PetRenderer (Sprite/Spine/...)  │  │   /rooms /room/:id    │    │
│  │   PetController + RAF loop        │  │   /agents /agent/:id  │    │
│  │   Physics, FSM bridge             │  │   /settings /skins    │    │
│  │   ClickThrough, DragHandler       │  │   /care    /chat-log  │    │
│  │   InteractionRouter (canvas)      │  │   /letters /journal   │    │
│  │                                   │  │   /chat               │    │
│  │ Vue micro-app (#overlay-dom):     │  │                       │    │
│  │   Bark, ThoughtBubble,            │  │ One Pinia store per   │    │
│  │   SpeechBubble, RadialMenu,       │  │ resource. Composables │    │
│  │   EmoteWheel, BondIndicator       │  │ wrap Tauri IPC.       │    │
│  └───────────────────────────────────┘  └───────────────────────┘    │
│                                                                     │
│  ┌── dialog-panel.html (floating) ──┐  ┌─ onboarding.html (boot) ─┐  │
│  │ Small WebviewWindow near pet      │  │ First-run only, closes   │  │
│  │ VN-style; refactor of v0.1.0      │  │ to pet-manager.html      │  │
│  │ chat-bubble.ts                    │  │ when complete            │  │
│  └───────────────────────────────────┘  └──────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

The architecture has **four orthogonal axes**:

1. **Body** — `PetRenderer` interface; one of Sprite/Spine/Live2D/Lottie/VRM backends; loaded from a skin manifest. See Section 5.
2. **Mind** — `AgentBackend` trait; one of `BuiltinAgent` (rig-core, in-process) or `ExternalAgentChannel` (OpenClaw via WebSocket). See Section 7.
3. **Behavior** — Pet behavior FSM, care system, bond engine; agent-backend-agnostic and skin-agnostic. Renders through whichever body is mounted.
4. **Interaction** — `InteractionRouter` and 15 mode implementations; renderer-agnostic and agent-backend-agnostic. See Section 6.

Any axis can be replaced independently of the others. A user can swap from a Sprite cat to a Live2D anime girl (body) while keeping the same memory, bond level, and personality (mind+behavior). They can switch from BuiltinAgent (cloud LLM) to ExternalAgentChannel (OpenClaw with MCP servers) without resetting the pet's state. They can disable Speech Bubble and enable Command Input (interaction profile) without touching the renderer or agent.

### 4.3 Window Topology

| Window | When opened | Lifetime | Tauri WebviewWindow |
|--------|-------------|----------|---------------------|
| `overlay.html` | Always on launch | Per pet (1 in v0.2; N in v0.5+) | yes (transparent) |
| `pet-manager.html` | Opened on demand from tray / overlay | Singleton; persists across sessions | yes |
| `dialog-panel.html` | When DialogPanelMode is the active conversation surface | Per active conversation | yes (small floating) |
| `onboarding.html` | First run only | Closes to Pet Manager | yes (bare) |

**Concurrent WebviewWindow budget:** 1 overlay + 1 Pet Manager + (optionally) 1 Dialog Panel = 3 simultaneous. Visual-rendering-spec Section 9.2 caps secondary windows at 3, and this topology stays at or below that ceiling. v0.5.0 multi-agent grows the overlay count to N but does not add any new singleton-style windows.

### 4.4 Data Flow Examples

**User chats with pet (v0.2.0, BuiltinAgent):**

```
User types in DialogPanel  → invoke('send_chat_message', { agent_id, text })
                           → Backend: AgentBackend::send_message
                           → BuiltinAgent: load context (personality, memory, bond level,
                              recent care state, recent letters/journal if relevant)
                           → BuiltinAgent: call rig-core with system prompt + tools
                           → Stream tokens via emit('chat-stream-token', { agent_id, token })
                           → DialogPanel typewriter renders tokens
                           → If tool_call: BuiltinAgent dispatches to pet body
                              (move_to → emit('pet-action'); change_state → emit; ...)
                           → Save conversation to SQLite
                           → Award bond points; check level-up; emit if level changed
```

**User chats with pet (v0.4.0+, ExternalAgentChannel via OpenClaw):**

```
User types in DialogPanel  → invoke('send_chat_message', { agent_id, text })
                           → Backend: AgentBackend::send_message
                           → ExternalAgentChannel: send to OpenClaw Gateway WebSocket
                              { channel: 'ditto', conversation: agent_id, text }
                           → OpenClaw Gateway routes to ditto channel plugin
                           → ditto channel plugin calls OpenClaw agent runtime with
                              agentPrompt-injected pet state (mood, bond, care, recent letter)
                           → OpenClaw agent runtime can use:
                              · pet-control tools surfaced by ditto channel agentTools factory
                              · all OpenClaw user-configured tools (filesystem, browser, MCP, ...)
                           → OpenClaw streams response back through ditto channel
                           → ditto channel plugin emits messages back over WebSocket
                           → ExternalAgentChannel forwards tokens to DialogPanel
                           → If tool_call is a pet-control tool: dispatched to pet body
                           → If tool_call is a user-tool: handled by OpenClaw, side effects in user environment
```

**Bond point accumulation (any agent backend):**

```
User performs care action  → invoke('apply_care_action', { action: 'feed' })
                           → Backend: care::apply
                           → Care state updated; emit('care-state-update')
                           → BondEngine.award(action_points('feed')) with daily cap check
                           → If new level reached: emit('bond-level-up', { old, new })
                           → emit propagates to overlay → BondIndicator + level-up ceremony
                           → Agent prompt template now includes new bond tier guide
                           → New PetState animation gates (e.g., 'cuddle') become available
                           → Locked interaction modes (Letter at Lv.6, Skit at Lv.8) unlock
```

**Time-driven Letter generation (v0.3.0+):**

```
App launches  → check last_active_timestamp; if offline > 4 hours and bond_level >= 6:
              → spawn background task: AgentBackend::generate_letter(context)
              → context: offline duration, last care state, last conversation topic, bond level
              → Agent generates letter content (Hybrid D: time-driven trigger,
                 agent-authored content, system-defined storage and surface)
              → Insert into letters table; emit('letter-arrived', { letter_id })
              → BarkMode shows envelope notification near pet
              → User opens Pet Manager /letters route to read
              → Letter content also added to long-term memory so the agent can
                 reference its own past letters in later conversations
```

---

## 5. Visual Rendering — Multi-Renderer System

This section is a **summary** of `docs/visual-rendering-spec.md`, which is the canonical reference. Read the full spec for protocol details, runtime selection guidance, and per-renderer implementation specifics.

### 5.1 Core Principle

> The skin is a projection of state, not the state itself.

The Agent holds all meaningful state (position, FSM state, personality, memory, mood, bond, expressions). Each renderer is a **pure function** of that state to visual output. Swapping skins is swapping the function; the underlying state is unchanged.

### 5.2 PetRenderer Protocol

Every renderer implements:

```typescript
interface PetRenderer {
  readonly type: 'sprite' | 'spine' | 'live2d' | 'lottie' | 'vrm';
  load(manifest: SkinManifest): Promise<void>;
  setState(state: PetState): void;
  hitTest(x: number, y: number): boolean;
  update(dt: number): void;
  getCanvas(): HTMLCanvasElement;
  capabilities(): RendererCapabilities;
  destroy(): void;
}
```

Optional capability interfaces: `LipSyncable`, `Expressible`, `ParameterDrivable`. Type guards (`isLipSyncable(r)` etc.) gate optional behavior. The InteractionRouter and other systems query `capabilities()` and degrade gracefully when a feature isn't supported by the active renderer.

### 5.3 Renderer Backends

| Renderer | Status | Ships in | CPU idle | RAM | Authoring barrier |
|----------|--------|----------|----------|-----|-------------------|
| **Sprite** (Canvas 2D) | shipped in v0.1.0; refactored behind `PetRenderer` interface in v0.2.0 | v0.2.0 | < 1% | < 10MB | Minimal — any image editor |
| **Spine** (`spine-canvas`) | new | v0.2.0 | 1-2% | 10-25MB | Medium-high — Spine Editor ($79+) |
| **Live2D** (PixiJS + pixi-live2d-display) | new | v0.3.0 | 2-4% | 30-60MB | High — Live2D Cubism Editor ($500/yr Indie) |
| **Lottie** (dotlottie-web) | optional | post v0.6.0 | < 1% | < 10MB | Low-medium — After Effects + Bodymovin |
| **VRM** (Three.js + @pixiv/three-vrm) | optional | post v0.6.0 | 3-5% | 60-100MB | Medium — VRoid Studio (free) |

**Excluded:** Rive (insufficient ecosystem), Phaser (game framework, not a rendering format), DragonBones (effectively unmaintained).

### 5.4 Skin Manifest (`skin.json`)

The base schema from visual-rendering-spec Section 5.1, **extended with v0.2 forward-compat fields**:

```json
{
  "schema_version": "1.0",
  "name": "Pixel Cat",
  "author": "community_user",
  "version": "1.0.0",
  "renderer": "sprite",
  "preview": "preview.png",
  "preview_animation": "idle",
  "size": { "width": 200, "height": 200 },
  "source": "local",
  "min_bond_level": 0,
  "license": "CC-BY-4.0",
  "tags": ["pixel", "cute", "cat"],
  "sprite": {
    "spritesheet": "spritesheet.png",
    "config": "animations.json",
    "layers": ["body", "expression", "accessory"]
  },
  "touch_zones": {
    "head":  { "x": 16, "y": 0,  "w": 32, "h": 20 },
    "body":  { "x": 12, "y": 20, "w": 40, "h": 24 },
    "belly": { "x": 16, "y": 30, "w": 32, "h": 14 },
    "limbs": { "x": 4,  "y": 44, "w": 56, "h": 20 },
    "tail":  { "x": 48, "y": 32, "w": 16, "h": 16 }
  },
  "state_map": { "idle": "idle", "walk_left": "walk_left", "...": "..." }
}
```

**New fields (all optional, default-friendly):**

| Field | Purpose |
|-------|---------|
| `preview_animation` | Animation to play in skin gallery preview tile (default: `idle`). |
| `source` | `"local"` \| `"workshop"` \| `"url"` — provenance tag for forward-compat with future remote sources without schema break. |
| `min_bond_level` | If > 0, skin appears greyed out in catalog with "Reach Bond Lv.N to unlock". |
| `license` | SPDX identifier for community / sharing clarity. |
| `tags` | Array for filtering and search in `/skins` route. |
| `touch_zones` | Per-zone hit rectangles for TouchZoneMode (Sprite renderer); other renderers use their native hit areas (Spine bounding box, Live2D `model.hitTest`). |

The `renderer`-specific block (`sprite`, `spine`, `live2d`, `lottie`, `vrm`) is identical to visual-rendering-spec Section 5.1.

### 5.5 Skin Distribution

| Layer | Location | Lifetime | Read-only? |
|-------|----------|----------|-----------|
| Built-in skins | App resource bundle (`$APP_RESOURCES/skins/`) | Per-install | yes |
| User-installed skins | User data dir (`$APPDATA/Ditto/skins/` Win; `~/Library/Application Support/Ditto/skins/` Mac; `~/.local/share/Ditto/skins/` Linux) | Persists across upgrades | no |
| URL/cache imports | User data dir (`$APPDATA/Ditto/skin-cache/`) | Persists; cleared by user | no |

The runtime merges both dirs into one catalog with `source` tags. `system/skins.rs` (renamed from `system/themes.rs`) provides:

| IPC command | Purpose |
|-------------|---------|
| `list_skins` | Merged catalog with metadata + bond-lock state per skin |
| `import_skin_zip(path)` | Validate + install a `.zip` from disk |
| `import_skin_url(url)` | Download + validate + install from URL |
| `delete_skin(id)` | Remove user-installed skin (cannot delete bundled) |
| `get_active_skin(agent_id)` / `set_active_skin(agent_id, skin_id)` | Per-agent active skin |

**Pet Manager `/skins` route** (v0.2.0):
- Grid layout with live preview animations
- Filter by renderer type (Sprite / Spine / Live2D / ...)
- Bond-level locks visible (greyed out)
- "Use" button per skin per agent
- Drag-and-drop file install
- "Import from URL" button

### 5.6 Skin Swap Flow

Per visual-rendering-spec Section 3.5: snapshot agent state → fade out (150ms) → destroy old renderer → create new → load → replay state → fade in (150ms). Agent state and pet position are preserved across the swap.

---

## 6. Interaction Modes

This section is a **summary** of `docs/interaction-modes-spec.md`, which is the canonical reference. Read the full spec for protocol details, per-mode designs, ASCII prototypes, and reference sources.

### 6.1 Core Principle

> The interaction mode is a projection of intent, not the intent itself.

Agent output (text, tool calls, emotions, inner thoughts), Care state, and FSM transitions are routed through the **InteractionRouter** to whichever modes the user has enabled. User gestures from active modes are normalized into `InteractionEvent`s and dispatched back to the agent / care / FSM. Switching modes is swapping presentation; the underlying state is unchanged.

### 6.2 InteractionRouter

```
┌────────────────────────────────────────────────────────────────┐
│                     InteractionRouter                           │
│                                                                 │
│  Outbound bus: AgentOutput / CareState / FSMTransition / ...   │
│   ──> all enabled modes' handleOutput()                         │
│                                                                 │
│  Inbound bus: gestures from canvas + DOM modes                  │
│   ──> dispatch InteractionEvent to agent / care / FSM           │
│                                                                 │
│  Mode lifecycle: enable → mount(context) ↔ unmount             │
│   on profile switch or per-mode toggle                          │
└────────────────────────────────────────────────────────────────┘
```

### 6.3 The 15 Modes

Grouped by tier (level of user disturbance):

| Tier | Modes | Surface |
|------|-------|---------|
| **Passive** (zero user action) | Bark, Thought Bubble | Canvas / DOM overlay |
| **Light** (simple gesture) | Speech Bubble, Radial Menu, Emote Wheel, Touch Zone | DOM / Canvas overlay |
| **Active** (deep engagement) | Dialog Panel, Command Input, Chat Log, Mini-Game | Floating WebviewWindow / Pet Manager route |
| **Review** (async / historical) | Dream Nail, Letter, Journal | DOM overlay / Pet Manager route |
| **Meta** (cross-cutting) | Bond Level, Skit (multi-agent only) | DOM indicator / WebviewWindow |

Each mode declares capabilities (`displaysText`, `acceptsTextInput`, `triggersCareActions`, `requiresWebview`, `allowsConcurrent`, `supportsMultiAgent`) so the InteractionRouter can route correctly.

### 6.4 Profiles

Three preset profiles ship in v0.2.0 (per interaction-modes-spec Section 5.1):

- **Minimal** — Bark, Thought Bubble, Radial Menu, Bond Level. Low disturbance.
- **Nurture** — All passive/light + Dialog Panel + Letter/Journal + Bond + Mini-Game. Cozy-game-leaning.
- **RPG** — All modes including Command Input + Chat Log + Skit. Power user.

Custom profile = Nurture preset + per-mode overrides + custom gesture map. JSON-editable for advanced users via `interaction-config.json` in user data dir.

### 6.5 Gesture Mapping

| Gesture | Default (Nurture) | Configurable |
|---------|-------------------|-------------|
| `double_click` | Open Dialog Panel | yes |
| `context_menu` | Open Radial Menu | yes |
| `alt_hover` | Activate Dream Nail (v0.3.0+) | yes |
| `emote_key` (E) | Open Emote Wheel | yes |
| `shift_click` | Open Chat Log | yes |
| `long_press` | Alt Radial Menu | yes |
| `hover` | Touch Zone detection | always-on when TouchZone enabled |

### 6.6 Mode Compatibility

Concurrent activation rules from interaction-modes-spec Section 5.3:

```
Always concurrent:        bark, thought_bubble, touch_zone, bond_level
Mutually exclusive (A):   speech_bubble | dialog_panel | command_input | chat_log
Mutually exclusive (B):   radial_menu | emote_wheel
Independent toggles:      dream_nail, letter, journal, mini_game, skit
```

Enforced by InteractionRouter on profile change.

---

## 7. AI Agent

### 7.1 AgentBackend Abstraction

```rust
trait AgentBackend {
    async fn send_message(&self, agent_id: AgentId, msg: UserMessage) -> Stream<Token>;
    async fn generate_letter(&self, agent_id: AgentId, ctx: LetterContext) -> Letter;
    async fn generate_journal_entry(&self, agent_id: AgentId, ctx: JournalContext) -> JournalEntry;
    async fn generate_inner_thought(&self, agent_id: AgentId) -> String;
    async fn generate_skit(&self, participants: Vec<AgentId>, topic: SkitTopic) -> Vec<SkitLine>;
    fn capabilities(&self) -> AgentCapabilities;
}
```

Two implementations:

#### 7.2 BuiltinAgent (rig-core, in-process)

The agent that ships with v0.1.0. Uses `rig-core` with multi-provider support (OpenAI, Anthropic, Ollama, OpenAI-compatible APIs). System prompt is built from `agent/prompt.rs` with personality, mood, needs, recent memories, time of day, and (v0.2.0+) bond tier guide.

Built-in tools (defined in `agent/tools.rs`, all pet-control):
- `move_to(x, y)` — move pet to screen position
- `change_state(state)` — change FSM state
- `show_emotion(emotion)` — display emotion overlay
- `speak(text)` — show text in chat surface (Bark / Bubble / Dialog depending on profile)
- `remember(key, value)` — long-term memory write
- `recall(key)` — long-term memory read

Provider chain (unchanged from v0.1.0): user-configured primary → user-configured fallback → rule-based offline fallback.

**No new work-tool capability is added in v0.2.0–v0.3.0.** The BuiltinAgent stays scoped to pet-control tools. Real work tools come via the ExternalAgentChannel in v0.4.0+.

#### 7.3 ExternalAgentChannel (v0.4.0)

A WebSocket client to the **OpenClaw Gateway**. Ditto registers as a new OpenClaw `ChannelPlugin` (in the OpenClaw repo, not in Ditto), conceptually similar to OpenClaw's existing `WebChat`, `Discord`, `Telegram`, etc. channels.

```
Ditto (Rust)                          OpenClaw Gateway (Node)
┌──────────────────────┐              ┌──────────────────────────────┐
│ ExternalAgentChannel │ ─WebSocket─> │ ditto channel plugin          │
│ ─ send_message       │              │   messaging (in/out)          │
│ ─ stream_token cb    │ <─stream──── │   streaming (token streams)   │
│ ─ tool_call cb       │ <─JSON-RPC── │   agentPrompt (inject pet     │
│ ─ tool_result        │ ─JSON-RPC──> │     state into system prompt) │
│ ─ pet_event push     │ ─JSON-RPC──> │   agentTools (expose pet      │
│   (state, care, bond)│              │     tools to OpenClaw agent)  │
│ ─ shutdown           │              │                               │
└──────────────────────┘              └──────────────────────────────┘
                                              │
                                              v
                                      ┌──────────────────────────┐
                                      │ OpenClaw agent runtime   │
                                      │ ─ memory plugin          │
                                      │ ─ user-configured tools  │
                                      │   (filesystem, browser,  │
                                      │    MCP servers, ...)     │
                                      │ ─ pet tools surfaced     │
                                      │   via ditto channel      │
                                      └──────────────────────────┘
```

The pet tools (`move_to`, `change_state`, …) are surfaced to the OpenClaw agent through the ditto channel's `agentTools` factory. The OpenClaw agent's other tools (real work tools — file edits, browser automation, MCP integrations, etc.) flow through the same agent runtime and execute in the user's OpenClaw environment, not in Ditto's process.

This means a user who uses Ditto with the OpenClaw backend gets a real work agent (matching the long-term D vision from grilling) while the cozy pet remains the visible surface.

**v0.4.0 deliverables in two repos:**

- **Ditto repo:** `src-tauri/src/agent/external_channel.rs` — WebSocket client; provider option in settings UI; bidirectional event mapping.
- **OpenClaw repo:** `src/channels/ditto/` — channel plugin implementing `ChannelPlugin`; `messaging`, `streaming`, `agentPrompt`, `agentTools`, `outbound` adapters; setup wizard for binding a Ditto installation to an OpenClaw account.

Both ship together as the v0.4.0 milestone.

### 7.4 Memory System

Unchanged from v0.1.0 in shape; extended in scope:

**Short-term (in-context):**
- Last 20 messages in current conversation
- Current pet state (mood, needs, position)
- Bond level + tier guide
- Time of day + user activity (idle/active)
- Active skin name (so the agent knows what it looks like)

**Long-term (SQLite):**
- User preferences and facts (existing)
- Conversation summaries (existing)
- Key events (existing)
- **(v0.3.0)** Letters written by the agent, queryable by date and bond tier
- **(v0.3.0)** Journal entries
- **(v0.3.0)** Skit dialogue (when multi-agent active in v0.5.0)
- Memory stored as key-value pairs with timestamps
- Searchable by relevance (keyword match in v0.2; embedding similarity in v0.6+)

Letters and journal entries are added to long-term memory after generation, so the agent can reference its own past inner life ("remember the night I wrote you about the rain..."). This is the loop that makes the cozy systems feel coherent with the agent rather than parallel to it.

### 7.5 Cozy ↔ Agent Integration (Hybrid D)

Bond Level, Letters, Journal, and Skit integrate with the agent through three coordinated surfaces:

**Surface 1: Animation gating (FSM-side, no agent involvement).**
Each `PetState` transition checks bond level. Skin manifests declare which animations are available at which bond tier. Examples: `cuddle` idle variant available at Lv.5+, exuberant happy at Lv.10, blush expression at Lv.7+. Agent doesn't need to "ask permission" — it requests `change_state('happy')` and the FSM picks the most appropriate variant for the current bond level.

**Surface 2: Prompt modifier (agent-side, ~30-50 tokens).**
A one-line tier guide is injected into the system prompt. Per interaction-modes-spec Section 6.3:
- Lv.1-2: "Be polite and reserved. Use formal language."
- Lv.3-4: "Be friendly and casual. Joke occasionally."
- Lv.5-6: "Be personal and warm. Share your feelings."
- Lv.7-8: "Be deeply trusting. Confide vulnerabilities."
- Lv.9-10: "Be fully authentic. No filters."

This shifts the agent's voice without bloating context.

**Surface 3: Time-driven authorship (system trigger, agent content).**
- Letters: triggered by `offline_duration > 4h && bond_level >= 6` on app launch. Agent receives a `LetterContext` (offline duration, last care state, last conversation topic, bond level) and generates 100-200 word content. Stored in `letters` table; surfaced via Letter mode.
- Journal: triggered at end of day (or on next launch if user closed earlier). Agent receives `JournalContext` (today's conversations summary, care actions, mood timeline, notable events). Generates 3-5 bullet first-person diary entry. Stored in `journal_entries` table.
- Skit (v0.5.0+): triggered when `2+ agents active && no skit in last 30min && user idle`. Agent runtime generates 4-8 line dialogue between two pets. Stored in `skits` table.

**Token cost:** ~30-50 tokens per system prompt for tier guide + occasional ~100 token relevant-letter recall = stays well under any reasonable budget.

This is the integration model that satisfies the user's stated direction — cozy systems "影响宠物的表现" (influence pet manifestation) primarily through animation gating, secondarily through agent voice tier, with the time-driven artifacts (letter/journal) flowing back into agent memory to close the loop.

### 7.6 Cost Control Strategy

Unchanged shape from v1.0 PRD Section 6.5. Updated table:

| Layer | Trigger | Cost | Latency |
|-------|---------|------|---------|
| **Rule-based** | Timer events, FSM transitions, simple bark candidates | Free | Instant |
| **Local LLM (Ollama)** | Simple chat, proactive comments, inner thought (Dream Nail) | Free | 1-5s |
| **Cloud LLM (fast)** | Normal conversation, screen awareness, journal entries | ~$0.001/turn | 0.5-2s |
| **Cloud LLM (smart)** | Complex reasoning, deep conversations, letter generation | ~$0.01/turn | 1-3s |
| **OpenClaw** (v0.4.0+) | Anything the OpenClaw agent runtime decides; user pays OpenClaw's costs | varies | varies |

Rate limits:
- Max 1 LLM call per 30s for proactive bark
- No limit on user-initiated conversation
- Screen capture + analysis ≤ once per 15 min
- Dream Nail ≤ 3 uses per day (rate limited)
- Letter generation ≤ 1 per offline period, queued if multiple sessions accumulated
- Local LLM preferred for proactive comments and inner thoughts

---

## 8. Care System & Bond Engine

### 8.1 Care System (shipped in v0.1.0, unchanged)

Four needs decay over time, replenished by interactions:

| Need | Decay rate | Critical threshold | Effect |
|------|-----------|-------------------|--------|
| Hunger | -1.0/hr | < 20 | Pet complains, moves slowly |
| Happiness | -0.5/hr | < 30 | Pet looks sad, less active |
| Energy | -0.3/hr | < 20 | Pet falls asleep, sluggish |
| Social | -0.2/hr | < 25 | Pet seeks attention, talks more |

Mood = weighted average of all four (formula in `care/needs.rs`). Mood label drives animation behavior and proactive triggers.

### 8.2 Bond Engine (new in v0.2.0)

A discrete relationship level (1-10) that quantifies the pet-user bond, modeled on Persona's Social Link / Confidant system. Levels unlock new behaviors, dialogue depth, animation variants, and interaction modes.

**Bond Level Table** (per interaction-modes-spec Section 4.14):

| Level | Title | Points required | Unlocks |
|-------|-------|----------------|---------|
| 1 | Stranger | 0 | Bark, basic Speech Bubble |
| 2 | Acquaintance | 50 | Thought Bubble icons |
| 3 | Friend | 150 | Radial Menu, Emote Wheel |
| 4 | Good Friend | 300 | Touch Zone reactions |
| 5 | Close Friend | 500 | Dream Nail, Dialog Panel VN theme |
| 6 | Best Friend | 800 | Command Input, Letter system |
| 7 | Family | 1200 | Journal, Mini-Games |
| 8 | Soulmate | 1800 | Skit System (multi-agent) |
| 9 | Inseparable | 2500 | Chat Log developer view |
| 10 | Bonded | 3500 | Hidden animations, secret dialogue, custom title |

**Point sources** (per interaction-modes-spec Section 4.14, with daily caps):

| Action | Points | Daily cap |
|--------|--------|-----------|
| Chat message (user) | +2 | 100 |
| Chat reply received | +1 | 100 |
| Feed | +5 | 5 |
| Pet (touch zone) | +3 | 10 |
| Play (mini-game) | +8 | 3 |
| Emote exchange | +2 | 10 |
| Letter reply | +15 | 2 |
| Daily login | +10 | 1 |
| Dream Nail use | +5 | 3 |

**Backend module:** `src-tauri/src/care/bond.rs` (new in v0.2.0). Subscribes to a bond-points event bus; persists to `bond_level` SQLite table; emits `bond-level-up` events on threshold crossings.

**Frontend surfaces:**
- `BondIndicator` (Vue component in overlay): small Lv. + heart-bar near pet, always visible when bond_level mode enabled.
- Level-up ceremony: full-screen-overlay animation + unlock notification + locked modes refresh.
- Pet Manager `/agent/:id` page: full bond history graph and unlock list.

**Animation gating:**
The FSM (in `behavior/state_machine.rs`) gains a `min_bond_level` annotation per state variant. Skin manifests can declare animation variants — e.g., `idle.standard`, `idle.cuddle` (Lv.5+), `idle.affectionate` (Lv.8+). FSM picks the highest-bond variant available for the requested state.

**Prompt integration:**
The `agent/prompt.rs` system prompt builder appends the tier guide string for the current bond level (from Section 7.5 Surface 2).

---

## 9. UI Architecture

### 9.1 Pet Manager Vue SPA

A single Tauri WebviewWindow hosting `pet-manager.html` — a Vue 3 + vue-router + Pinia app.

**v0.2.0 routes:**

| Route | Purpose |
|-------|---------|
| `/rooms` | Stub in v0.2.0; full UI in v0.5.0 multi-agent (a "room" is a logical grouping of agents) |
| `/agents` | Agent list (1 agent in v0.2; N in v0.5+) |
| `/agent/:id` | Agent detail: name, personality, bond level, active skin, conversation summary |
| `/skins` | Skin gallery with live preview, filters, install/delete |
| `/chat` | Chat interface (alternative to Dialog Panel for users who prefer panel-in-window) |
| `/care` | Care panel: need bars, action buttons, mood graph |
| `/settings` | LLM config, pet name, behavior preferences, agent backend selection (BuiltinAgent / OpenClaw in v0.4+) |

**v0.3.0+ routes added:**

| Route | Purpose |
|-------|---------|
| `/letters` | Letter archive with read/reply |
| `/journal` | Daily diary with calendar view + milestone highlights |
| `/chat-log` | MMO-style multi-tab persistent log (Chat / System / Memory tabs) |

### 9.2 Per-Pet Overlay Window

`overlay.html` — transparent, frameless, always-on-top. One per active pet. Hosts:

- **Vanilla TS module:** PetRenderer instance (Sprite/Spine/Live2D/...), PetController, requestAnimationFrame loop, ClickThroughHandler, DragHandler, InteractionRouter.
- **Vue 3 micro-app** mounted on `<div id="overlay-dom">`: declarative DOM-overlay modes (Bark, ThoughtBubble, SpeechBubble, RadialMenu, EmoteWheel, BondIndicator).

The Vue runtime is shared with the Pet Manager via Vite chunk splitting — same Vue runtime, two micro-apps.

**Performance-critical path stays vanilla.** The renderer/animation/physics loop never enters Vue. Vue only owns DOM-overlay state.

### 9.3 Floating Dialog Panel

`dialog-panel.html` — small WebviewWindow positioned next to the pet. Used when DialogPanelMode is the active conversation surface (Nurture / RPG profiles).

Conceptually replaces v0.1.0's `chat-bubble.ts` window but with VN-style layout: portrait + bond level header + scrollable history + suggested replies + free-text input. The same Vue components used by `/chat` route in Pet Manager are reused inside the dialog panel — different host, same UI primitives.

### 9.4 Onboarding

`onboarding.html` — bare WebviewWindow, runs first-launch only. Vue app shell with single screen (pet name, LLM provider config). On completion, opens Pet Manager and overlay, closes itself.

### 9.5 Window Lifecycle

```
App launch (first run)
  └─ open onboarding.html
       └─ user completes setup
            ├─ open overlay.html (transparent)
            └─ open pet-manager.html
                 └─ close onboarding.html

App launch (subsequent runs)
  ├─ open overlay.html
  └─ open pet-manager.html on tray click or user action
       (pet-manager is opt-in, not always-open, to keep RAM lean)

User triggers Dialog Panel
  └─ open dialog-panel.html (singleton; reuse if already open)

User changes interaction profile
  └─ InteractionRouter unmounts/mounts modes; no window changes
```

---

## 10. Distribution & Platform Support

### 10.1 Per-Version Platform Matrix

| Version | Windows | macOS | Linux |
|---------|---------|-------|-------|
| v0.1.0 (shipped) | 10+ x64 | 12+ Universal | not supported |
| v0.2.0 — v0.3.0 | 10+ x64 | 12+ Universal | not supported |
| v0.4.0+ | 10+ x64 | 12+ Universal | x64 (.deb + .AppImage); X11 supported, Wayland best-effort |
| Always out of scope | Windows ARM, Windows 7/8 | macOS Intel-only fallback (Universal handles both), macOS < 12 | ARM Linux, RISC-V |

Rationale: each new renderer introduces transparent-window/click-through risk; staging Spine (v0.2) and Live2D (v0.3) on the two best-supported Tauri platforms first lowers the multi-renderer risk surface. Linux joins at v0.4.0 once renderers are stable.

### 10.2 Installer Format

| Platform | Format | Tooling |
|----------|--------|---------|
| Windows | MSI (preferred) + NSIS (alt) | Tauri bundler, code-signed |
| macOS | DMG (Universal) | Tauri bundler, notarized |
| Linux (v0.4.0+) | .deb + .AppImage | Tauri bundler |

Auto-update: Tauri built-in updater (already configured in v0.0.6).

---

## 11. Roadmap

The v1.0 PRD delivered Phases 1-5 (Skeleton, Life, Mind, Soul, Polish). v2.0 continues the harness phase numbering: **Phase 6 onward**.

| Phase | Version | Theme | Duration |
|-------|---------|-------|----------|
| **6** | v0.1.x → v0.1.5 | Skin Foundation | 3 weeks |
| **7** | v0.1.5 → v0.2.0 | Interaction Foundation | 3 weeks |
| **8** | → v0.3.0 | Depth & Cozy Loop (Live2D + Active/Review modes) | 6 weeks |
| **9** | → v0.4.0 | Pluggable Agent (OpenClaw channel + Linux) | 5 weeks |
| **10** | → v0.5.0 | Multi-Agent (multiple pets + Skit) | 5 weeks |
| **11** | → v0.6.0 | Production Quality | 4-6 weeks |
| post-v0.6 | TBD | Ecosystem (VRM, Lottie, MCP host, Steam Workshop, paid DLC) | TBD |

v1.0 is deliberately out of scope. The project is complex enough that committing to a v1.0 cliff is not yet honest. v0.6.0 is the quality-bar release; further versions will continue past it without a forced 1.0 milestone.

### 11.1 Phase 6 — Skin Foundation (v0.1.x → v0.1.5)

**Goal:** Multi-renderer architecture in place; Spine renderer end-to-end; skin distribution working; Pet Manager SPA shell.

**Features (~12):**
- Extract `PetRenderer` interface from current `SpriteEngine`
- Wrap current sprite logic as `SpriteRenderer` implementing `PetRenderer` (no behavior change)
- Implement `SpineRenderer` using `@esotericsoftware/spine-canvas`
- `RendererFactory` based on `skin.json.renderer` field
- Skin manifest schema v1.0 with v0.2 forward-compat fields (Section 5.4)
- Skin discovery from app bundle + user data dir, merged catalog
- IPC: `list_skins`, `import_skin_zip`, `import_skin_url`, `delete_skin`, `get_active_skin`, `set_active_skin`
- Pet Manager Vue SPA shell (replaces standalone chat-bubble/care-panel/settings windows)
- `/skins` route: grid + live preview + filter + bond-lock (Lv.0 unlocked, others "Reach Lv.N")
- Migration: existing settings → schema with default skin reference; rename `system/themes.rs` → `system/skins.rs`
- Sample Spine skin shipped (one cute character demonstrating skeletal animation)
- Forward-compat: extract `AgentBackend` trait scaffold and event-bus pattern (no behavior change yet)

**Verification:**
- [ ] `PetRenderer` interface compiles; existing sprite tests pass against `SpriteRenderer` wrapper
- [ ] Spine sample skin loads and animates with no flicker
- [ ] User can install a `.zip` skin via Pet Manager dialog
- [ ] User can install a skin from a URL
- [ ] User can drag-and-drop a skin folder into Pet Manager
- [ ] `/skins` route shows live preview animations for all installed skins
- [ ] Renaming `themes.rs` → `skins.rs` does not break v0.1.0 settings (migration runs)
- [ ] Old chat-bubble / care-panel / settings windows are gone; their UI lives as Pet Manager routes
- [ ] All v0.1.0 tests still pass; new tests cover renderer factory + skin discovery + Spine rendering

### 11.2 Phase 7 — Interaction Foundation (v0.1.5 → v0.2.0)

**Goal:** InteractionRouter operational; Light-tier modes functional; Bond Level engine integrated end-to-end.

**Features (~13):**
- `InteractionRouter` core (outbound bus, inbound bus, gesture dispatch, mode lifecycle)
- Mount Vue micro-app on overlay's `#overlay-dom` for DOM-overlay modes
- Refactor `setup-events.ts` to delegate to InteractionRouter (drop hardcoded `dblclick`/`contextmenu`)
- BarkMode (canvas or DOM, typewriter + queue + fade)
- ThoughtBubbleMode (canvas overlay, icon + bounce + critical pulse)
- SpeechBubbleMode (DOM, typewriter + quick-reply chips, position-flip near top of screen)
- RadialMenuMode (SVG, angle calculation, segment highlight, default care actions)
- EmoteWheelMode (radial-menu-derived, emote-to-bark/state mapping, care effects)
- TouchZoneMode (`skin.json` zone rectangles for Sprite, hitTest delegation, hover/click reactions)
- DialogPanelMode (Pet Manager `/chat` route OR small floating WebviewWindow per profile config)
- BondLevel engine (`care/bond.rs`, points event bus, threshold table, daily caps, level-up emission)
- BondIndicator (Vue overlay component) + level-up ceremony animation + unlock notifications
- Bond → animation gating in FSM + bond → system prompt modifier in `agent/prompt.rs`
- Interaction profiles (Minimal/Nurture/RPG) + Settings UI extension; mode compatibility enforcement

**Verification:**
- [ ] `InteractionRouter.handleGesture('double_click')` correctly opens whichever mode the profile maps to
- [ ] Bark text appears above pet, typewriter effect, auto-fades; queues at most 3
- [ ] Thought icons appear for critical care needs and clear when need recovers
- [ ] Speech bubble shows Agent response with quick-reply chips; flips position near top of screen
- [ ] Radial menu opens on right-click, hovering segments highlights them, releasing dispatches care action
- [ ] Emote wheel opens on E key; selecting emote triggers pet response + care effect
- [ ] Hovering over pet head/body/tail produces different bark reactions
- [ ] Bond points accumulate from all interactions; daily caps enforced
- [ ] Crossing bond threshold triggers ceremony + unlock notification
- [ ] At Lv.5 the Dream Nail mode appears in Settings as available; below Lv.5 it shows "Reach Lv.5"
- [ ] Switching profile (Minimal → Nurture → RPG) correctly mounts/unmounts modes
- [ ] Mutually-exclusive groups enforced (cannot enable Speech Bubble + Dialog Panel simultaneously)
- [ ] All Phase 6 tests still pass; new tests cover InteractionRouter + each mode + Bond engine

### 11.3 Phase 8 — Depth & Cozy Loop (v0.3.0)

**Goal:** Live2D renderer; Active and Review-tier modes; full cozy loop (letters + journal + dream nail + mini-games).

**Features (~16):**
- `Live2DRenderer` using PixiJS v6 + pixi-live2d-display + Cubism 4 Core (PoC validation on day 1: WebGL transparency in Tauri on Win + macOS)
- WebGL transparency configuration (frontend + Rust NSWindow on macOS)
- `LipSyncable` capability via `ParamMouthOpenY` driving from streaming TTS (when available) or text length
- `Expressible` capability via Live2D Expression system
- One sample Live2D skin shipped (with explicit BYO-model documentation for users)
- CommandInputMode (inline terminal, autocomplete, command parsing)
- ChatLogMode (Pet Manager `/chat-log` route, multi-tab Chat/System/Memory)
- MiniGameMode infrastructure (Pet Manager `/play/:game` route or small WebviewWindow) — ship 2 games (Rock-Paper-Scissors, Catch-the-Food)
- DreamNailMode (Alt+hover overlay, secondary agent prompt for inner thought, rate-limited)
- LetterMode + Letter generation pipeline (offline trigger, agent-authored content, archive in Pet Manager `/letters`)
- JournalMode + Journal generation pipeline (end-of-day trigger, calendar view in Pet Manager `/journal`)
- New SQLite tables: `letters`, `journal_entries`, `mini_game_results`
- IPC: `get_pending_letters`, `mark_letter_read`, `send_letter_reply`, `get_letter_archive`, `get_journal_entries`, `generate_journal_entry`, `start_mini_game`, `submit_mini_game_result`, `generate_inner_thought`
- Letter and journal entries fed back into long-term memory
- Bond-level gating on Letter (Lv.6+) / Journal (Lv.7+) / Dream Nail (Lv.5+) / Mini-Games (Lv.7+)

**Verification:**
- [ ] Live2D PoC: transparent WebGL Live2D model renders on Windows and macOS without flicker or background
- [ ] Sample Live2D skin loads via skin import; lip-sync drives from streaming response
- [ ] Command input parses "feed", "play", "status", free-text correctly
- [ ] Chat log shows all message types with tab filtering and persistence
- [ ] Rock-Paper-Scissors mini-game plays 5 rounds, awards Happiness, records result
- [ ] Catch-the-Food mini-game tracks score, awards Hunger
- [ ] Dream Nail: Alt+hover shows inner monologue distinct from public speech; rate limit (3/day) enforced
- [ ] Letters: 4+ hour offline + Lv.6+ generates letter; surfaces with envelope notification on launch; reply works
- [ ] Journal entries auto-generated daily; calendar view in Pet Manager
- [ ] Memory recall: agent references past letter content in conversation
- [ ] Performance: 4 simultaneous DOM modes + 1 Live2D renderer stays under CPU/RAM budget

### 11.4 Phase 9 — Pluggable Agent + Linux (v0.4.0)

**Goal:** OpenClaw integration as ExternalAgentChannel; Linux x64 support added.

**Features (~10):**
- `AgentBackend` trait promoted from scaffold to load-bearing; `BuiltinAgent` impl unchanged
- `ExternalAgentChannel` impl: WebSocket client to OpenClaw Gateway
- Settings UI: agent backend selector (BuiltinAgent / OpenClaw); per-backend config
- OpenClaw connection status indicator; connection wizard (paste OpenClaw Gateway URL + auth)
- Pet event push from Ditto to OpenClaw (FSM transitions, care state, bond level)
- Tool surface: pet-control tools exposed to OpenClaw via channel `agentTools` factory
- Tool routing: distinguish pet-control tools (Ditto handles) from work tools (OpenClaw handles)
- Linux x64 build (.deb + .AppImage) added to Tauri bundler config
- Linux X11 transparency + click-through verification on common DEs (GNOME/KDE)
- Linux CI matrix entry; smoke tests on AppImage
- **(OpenClaw repo)** New `ditto` ChannelPlugin in `src/channels/ditto/` with full adapter implementation
- **(OpenClaw repo)** Channel docs page (`docs/channels/ditto.md`)
- **(OpenClaw repo)** Setup wizard for binding Ditto to OpenClaw account

**Verification:**
- [ ] User can switch from BuiltinAgent to OpenClaw in Settings; pet behavior continues seamlessly
- [ ] OpenClaw agent invokes `move_to` tool; pet moves correctly
- [ ] OpenClaw agent uses a non-pet tool (e.g., file read via OpenClaw filesystem plugin); user sees both the pet response and the tool effect
- [ ] OpenClaw agent receives bond level + care state in system prompt (verified in OpenClaw logs)
- [ ] Switching back to BuiltinAgent works and preserves all pet state
- [ ] Linux x64 .deb installs cleanly on Ubuntu 22.04+
- [ ] Linux x64 .AppImage runs on common distros without unmet deps
- [ ] X11 transparent window confirmed on GNOME and KDE
- [ ] Wayland behavior documented (known limitations listed)

### 11.5 Phase 10 — Multi-Agent (v0.5.0)

**Goal:** Multiple simultaneous pets; Skit mode; cross-agent memory; AgentList/RoomList full UI.

**Features (~12):**
- Multi-window overlay management: spawn N transparent overlays, one per agent
- Per-agent state isolation: bond, memory, personality, skin, position
- Agent creation flow in Pet Manager (`/agents` New button → Onboarding-lite for the new agent)
- Agent deletion / archival
- AgentList and RoomList full implementation (replaces v0.2.0 stubs)
- Rooms: logical grouping of agents (e.g., "Workspace pets" / "Cozy corner")
- Cross-agent memory sharing (opt-in per agent pair)
- Skit generation: trigger conditions, dialogue generation, playback panel (`/skits` or floating window)
- Skit `start_skit` IPC; Skit display mode
- Per-agent interaction profile (each agent can have its own enabled modes)
- Multi-agent CPU/RAM budget enforcement (warn at 3+ active pets, soft cap at 5)
- Settings: max concurrent agents

**Verification:**
- [ ] User can create a 2nd agent; both pets appear on screen with own personalities
- [ ] Each agent has independent bond level, care state, memory
- [ ] Skit fires when conditions met; both pets visible during skit; user can watch or skip
- [ ] Switching active agent in Pet Manager `/agents` shows correct details per agent
- [ ] 3 simultaneous Sprite agents stay under 100MB total RAM
- [ ] 2 Sprite + 1 Live2D agents stay under 150MB total RAM

### 11.6 Phase 11 — Production Quality (v0.6.0)

**Goal:** Ship-quality stability, accessibility, localization, performance.

**Features (~12):**
- Full i18n: en-US (default), zh-CN (existing partial), framework for additional locales
- Accessibility: keyboard navigation for Radial Menu / Emote Wheel / Pet Manager; screen reader labels
- Performance regression suite: per-renderer benchmarks, per-mode RAM/CPU measurement, automated alerts
- Crash reporting (opt-in) and recovery: pet state auto-saved every 30s; recovers from corruption
- Improved error UX: graceful fallback chains, user-visible explanations for LLM failures
- Documentation: user manual, skin authoring guide (Sprite + Spine + Live2D), interaction-mode guide, troubleshooting
- Telemetry (opt-in) for usage patterns to inform post-v0.6 roadmap
- Polish pass on all UI: animations, microcopy, empty states, error states
- Onboarding refinement based on user feedback from v0.2-v0.5
- Steam release readiness as **stretch goal**: store page assets, Steam DRM-free packaging, Steam achievement integration if pursued
- Auto-update channel (stable / beta) with rollback support
- Feature-flag system for gradually shipping experimental modes/renderers

**Verification:**
- [ ] All UI strings localizable; en-US and zh-CN fully translated
- [ ] Pet Manager fully keyboard-navigable; tab order correct; focus visible
- [ ] Performance regression CI fails build if RAM/CPU rises >10% from baseline
- [ ] Pet recovers from forced kill: state restored to within last 30s
- [ ] Documentation site published; skin authoring guide includes per-renderer tutorials
- [ ] User manual covers all 15 interaction modes with screenshots
- [ ] Steam release readiness: go/no-go decision with budget owner; if go, follow-up release plan

### 11.7 Post-v0.6 (Ecosystem)

Not committed; tracked as a backlog. Likely contents:

- **VRMRenderer** — 3D humanoid avatars via Three.js + @pixiv/three-vrm
- **LottieRenderer** — Vector animation via dotlottie-web
- **MCP host capability** in BuiltinAgent — adds external work-tool reach without requiring OpenClaw
- **Steam Workshop integration** — paid + free skin distribution; only if v0.6 traction justifies the licensing/store overhead
- **Paid Live2D DLC** — official anime-style skins; only if Cubism license cost can be amortized
- **Mobile companion** — read-only iOS/Android app to view letters/journal/bond status when away from desktop
- **Voice (TTS in / STT out)** — pet speaks aloud; user speaks to pet
- **Screen action automation** — pet can autonomously take actions on screen (with user approval)

---

## 12. Non-Functional Requirements

### 12.1 Performance Budget

| Metric | Target (single pet, idle) | Target (active conversation) |
|--------|--------------------------|-----------------------------|
| RAM (Sprite) | < 50MB | < 200MB |
| RAM (Spine) | < 75MB | < 250MB |
| RAM (Live2D) | < 110MB | < 350MB |
| CPU (Sprite) | < 5% | < 15% |
| CPU (Spine) | < 6% | < 17% |
| CPU (Live2D) | < 8% | < 20% |
| Animation latency | < 16ms / frame (60 FPS, Sprite/Spine; 30 FPS Live2D acceptable) | same |
| LLM response first token | < 3s (BuiltinAgent) | < 4s (OpenClaw via WebSocket) |
| Cold start | < 3s | n/a |
| Conversation storage | SQLite, < 200MB after 1 year of use | n/a |

### 12.2 Concurrent Window Limits

| Constraint | Limit | Rationale |
|-----------|-------|-----------|
| Total Tauri WebviewWindows | 3 simultaneous in v0.2-v0.4 (overlay + manager + dialog); 5+ in v0.5+ (per-agent overlays) | Each WebView is a Chromium renderer process |
| DOM-overlay modes per overlay window | 6 simultaneously | Lightweight |
| Canvas-overlay modes per overlay window | 3 simultaneously | Avoid canvas redraw contention |
| Concurrent agents (multi-agent v0.5+) | Soft cap 5; warn at 3 | Per-agent budget * N |

### 12.3 Reliability

- App auto-saves pet state every 30s
- DB corruption recovery: auto-recreate from migration template if integrity check fails (existing in v0.1.0)
- LLM error recovery: provider fallback chain (existing in v0.1.0)
- Offline mode: rule-based behavior fully functional without internet; conversation suggests local LLM if cloud unreachable
- v0.6.0+: opt-in crash reporting

### 12.4 Compatibility

- Existing v0.1.0 user data fully migrated by Phase 6 schema changes (no data loss)
- New schema fields are additive where possible
- Skin manifest schema versioned (`schema_version`); new fields optional with defaults
- Interaction config JSON-editable for power users; default profiles regenerated if missing

---

## 13. Risk Assessment

Risks specific to v0.2.0+ (v0.1.0 risks already mitigated by shipping):

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Live2D WebGL transparency fails in Tauri | Medium | High (Live2D unusable) | PoC on day 1 of Phase 8; fallback: render to offscreen WebGL, copy to Canvas 2D via drawImage |
| PixiJS v6 lock-in for pixi-live2d-display | Medium | Medium | Use `@seayoo-web/pixi-live2d` community re-wrap supporting PixiJS v7+; isolated to Live2D renderer window |
| Multi-window resource explosion (v0.5) | High | Medium | Default soft cap 5 agents; lazy-create WebviewWindows; visible RAM/CPU indicator in Pet Manager |
| Spine Editor license requirement for Workshop creators | Medium | Low (Sprite is the primary community format) | Document Sprite as primary; ship Spine templates; Spine treated as "advanced Workshop" tier |
| OpenClaw integration is bilateral (two repos) | Medium | Medium | Phase 9 deliverable spans both repos; coordinate releases; graceful degradation if OpenClaw side absent |
| OpenClaw API drift breaks Ditto channel plugin | Medium | Medium | Pin OpenClaw version in Ditto's settings; version-check on connection; update channel plugin in lockstep |
| InteractionRouter complexity (15 modes) | Medium | Medium | Phased delivery (Phase 7 ships 6 modes; Phase 8 adds 6 more; Phase 10 adds Skit); strict protocol interface |
| Bond + LLM prompt token bloat | Low | Low | Tier guide stays ≤ 50 tokens; recent letter recall only when relevant |
| Letter quality at low bond | Low | Low | Letters only available at Bond Lv.6+; design embraces brevity at low tiers |
| Linux Wayland transparent window | Medium | Low | Document X11-only as supported; Wayland best-effort with known limitations published |
| Live2D Cubism license fees ($500/yr Indie) | Low | Medium | Defer official Live2D DLC to post-v0.6; until then, Live2D ships as runtime support for user-imported models only — no Cubism license needed |
| Steam release feasibility | Low | Low (it's a stretch goal) | Steam stays optional through v0.6; go/no-go decision in Phase 11 with explicit budget review |

---

## 14. Open Questions

None at PRD finalization. All design decisions resolved through cross-reference of the two specs and grilling. Open questions arising in implementation will be tracked in the harness phase eval reports.

---

## Appendix A: Reference Specs

| Document | Role | Last updated |
|----------|------|------|
| `docs/visual-rendering-spec.md` | Canonical multi-renderer architecture | 2026-04-24 |
| `docs/visual-rendering-spec.zh.md` | Chinese translation | 2026-04-24 |
| `docs/interaction-modes-spec.md` | Canonical interaction-mode architecture | 2026-04-24 |
| `docs/interaction-modes-spec.zh.md` | Chinese translation | 2026-04-24 |
| `CLAUDE.md` | Codebase guide for AI coding assistants | 2026-04-26 |

The two specs are the *detailed* references. This PRD is the *integrated* product roadmap that incorporates them.

## Appendix B: Reference Projects

| Project | Language | Relevance |
|---------|----------|-----------|
| **OpenClaw** (user's own project) | TypeScript (Node.js) | The external agent backend Ditto integrates with in v0.4.0 via a new `ditto` ChannelPlugin |
| [airi](https://github.com/airi-soft/airi) | TS | AI desktop pet — UI patterns, agent integration approach |
| [BongoCat](https://github.com/ayangweb/bongocat) | Rust + Tauri | Tauri transparent window patterns |
| [VPet-Simulator](https://github.com/LorisYounger/VPet) | C#/.NET | Steam Workshop pet ecosystem reference |
| [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | Python | Memory + screen awareness patterns |
| [Mate-Engine](https://github.com/mate-engine) | Engine analysis in `.repos/2026-03-30-mate-engine-deep-analysis.md` | Animation engine reference |
| [Hades](https://www.youtube.com/watch?v=bwdYL0KFA_U) | Game (Supergiant) | Bark / ambient dialogue system inspiration |
| [Persona 5](https://www.gamedeveloper.com/design/same-but-different---comparing-the-social-link-system-in-persona-3-4-5) | Game (Atlus) | Social Link / Bond Level system inspiration |
| [Hollow Knight](https://www.reddit.com/r/HollowKnight/comments/16yso3w/) | Game (Team Cherry) | Dream Nail / inner thought mechanic inspiration |
| [Animal Crossing](https://animalcrossing.fandom.com/wiki/Letter) | Game (Nintendo) | Letter system inspiration |

## Appendix C: Versioning & Releases

| Version | Status | Date | Highlights |
|---------|--------|------|-----------|
| v0.1.0 | shipped | 2026-04-26 | All 5 phases of v1.0 PRD complete; Vue migration; ready for v2.0 work |
| v0.1.x | Phase 6 progress | (in progress) | Skin Foundation (Sprite refactor + Spine + skin distribution + Pet Manager shell) |
| v0.1.5 | target | TBD | Phase 6 complete |
| v0.2.0 | target | TBD | Phase 7 complete (Interaction Foundation + Bond Level) |
| v0.3.0 | target | TBD | Phase 8 (Live2D + Active/Review modes + cozy loop) |
| v0.4.0 | target | TBD | Phase 9 (OpenClaw + Linux) |
| v0.5.0 | target | TBD | Phase 10 (Multi-Agent + Skit) |
| v0.6.0 | target | TBD | Phase 11 (Production Quality) |
