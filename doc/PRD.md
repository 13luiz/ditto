# Ditto — Agent-Driven Desktop Pet PRD

> **Version:** 1.0
> **Date:** 2026-04-21
> **Status:** Design Approved
> **Platforms:** Windows, macOS

---

## 1. Vision

Ditto is an Agent-driven desktop pet application built with Rust. A small animated creature lives on your desktop — walking, climbing, sleeping, and playing. Unlike scripted desktop pets, Ditto's behavior is governed by an AI Agent that can hold conversations, perceive your screen, remember past interactions, and develop a personality over time.

**Tagline:** A living companion on your desktop, powered by AI.

---

## 2. Target Users

- Knowledge workers and developers who spend long hours at the computer
- Fans of desktop pets (Shimeji, Desktop Goose, VPet-Simulator)
- Users who want an AI companion that feels present without being intrusive
- Cozy gaming / Tamagotchi enthusiasts

---

## 3. Core Features

### 3.1 Desktop Pet (Must-Have)

| Feature | Description |
|---------|-------------|
| Transparent overlay | Pet lives in a transparent, always-on-top, frameless window |
| Sprite animation | 2D sprite sheet-based animation with state machine |
| Movement | Walk, run, climb screen edges and window borders, fall, jump |
| Cursor interaction | Chase cursor, flee from cursor, follow cursor |
| Grab & drag | User can pick up and move the pet |
| Idle animations | Fidgeting, stretching, grooming, sleeping — never completely still |
| Multi-monitor | Pet can move between monitors |

### 3.2 AI Agent (Must-Have)

| Feature | Description |
|---------|-------------|
| Conversation | Chat with the pet via text bubble — natural language responses |
| Personality engine | Personality traits that shift based on interactions over time |
| Memory system | Short-term (recent context) + long-term (key facts about user) |
| Screen awareness | Pet can see your screen and comment on what you're doing |
| Proactive behavior | Pet initiates conversation based on context (idle time, time of day, screen content) |
| Tool calling | Agent can control pet behavior (movement, state, emotion) via tool calls |
| Multi-provider LLM | Cloud (OpenAI, Claude) + local (Ollama) with automatic fallback |
| Cost control | Rule-based layer handles 80% of interactions; LLM only for complex tasks |

### 3.3 Care System (Must-Have)

| Feature | Description |
|---------|-------------|
| Hunger | Decays over time, replenished by feeding |
| Happiness | Decays over time, replenished by playing/petting |
| Energy | Decays over time, replenished by sleeping |
| Social | Decays over time, replenished by chatting |
| Mood system | Weighted average of all needs, affects animations and personality |

### 3.4 System Integration (Must-Have)

| Feature | Description |
|---------|-------------|
| System tray | Minimize to tray, settings access |
| Auto-launch | Optional startup with OS |
| Settings | LLM provider config, pet appearance, behavior preferences |
| Notification | Chat bubble notifications, break reminders |

### 3.5 Extensibility (Nice-to-Have)

| Feature | Description |
|---------|-------------|
| Custom pet themes | Load custom sprite sheets and animation definitions |
| Plugin system | Community extensions for new behaviors and tools |

---

## 4. Architecture

### 4.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| App framework | **Tauri v2** | Transparent window, system tray, cross-platform (Win+Mac), 3-10MB binary |
| Frontend rendering | **Canvas 2D** (baseline) + **WebGPU** (optional accel) | Sprite rendering in Tauri's webview; Canvas for reliability, WebGPU for effects |
| Frontend framework | **SolidJS** (or Vanilla TS) | Lightweight reactive UI, no virtual DOM overhead, good for overlay apps |
| Backend language | **Rust** | Performance, safety, Tauri native |
| AI Agent framework | **rig-core** | Mature Rust agent framework; 20+ LLM providers; tool calling; streaming |
| Local LLM runtime | **Ollama** (via API) | Best local LLM experience; rig-core supports it natively |
| Database | **SQLite** via rusqlite | Conversations, pet state, memory, settings |
| System tray | **tray-icon** crate | Cross-platform system tray for Tauri |
| Input monitoring | **rdev** crate (or **mouce** as fallback) | Global mouse/keyboard events for cursor awareness; rdev requires accessibility perm on macOS |
| Screen capture | **screenshots** crate or **xcap** | Screen awareness feature |
| Animation definition | **JSON** + PNG sprite atlas | Simple, human-editable animation definitions |
| Packaging | **Tauri bundler** | Windows installer (.msi/.exe) + macOS .dmg, auto-update |

### 4.2 System Architecture

```
┌─────────────────────────────────────────────────┐
│                  Tauri v2 App                    │
│                                                  │
│  ┌──────────── Frontend (Web) ────────────────┐  │
│  │                                             │  │
│  │  Pet Renderer                               │  │
│  │    - Canvas 2D sprite rendering             │  │
│  │    - Sprite sheet frame animation           │  │
│  │    - Transparent window compositing         │  │
│  │                                             │  │
│  │  UI Layer                                   │  │
│  │    - Chat bubble (AI conversation)          │  │
│  │    - Settings panel                         │  │
│  │    - Need bars (hunger, happiness, etc.)    │  │
│  │    - Pet name tag                           │  │
│  │    - Onboarding overlay                     │  │
│  │                                             │  │
│  └───────────── IPC (Tauri Commands) ──────────┘  │
│                       ↕                           │
│  ┌──────────── Backend (Rust) ────────────────┐  │
│  │                                             │  │
│  │  Agent Core (rig-core)                      │  │
│  │    - LLM provider abstraction               │  │
│  │    - Tool calling system                    │  │
│  │    - Streaming responses                    │  │
│  │    - Conversation management                │  │
│  │                                             │  │
│  │  Personality & Memory Engine                │  │
│  │    - Personality trait state                │  │
│  │    - Short-term memory (sliding window)     │  │
│  │    - Long-term memory (summarized facts)    │  │
│  │    - Mood calculation                       │  │
│  │                                             │  │
│  │  Pet Behavior Engine                        │  │
│  │    - Finite state machine                   │  │
│  │    - Behavior scheduler (timers + events)   │  │
│  │    - Desktop interaction (edges, windows)   │  │
│  │    - Cursor tracking & response             │  │
│  │    - Physics (gravity, collision)           │  │
│  │                                             │  │
│  │  Care System                                │  │
│  │    - Need decay (hunger, happiness, etc.)   │  │
│  │    - Interaction rewards                    │  │
│  │    - Care action handlers                   │  │
│  │                                             │  │
│  │  System Integration                         │  │
│  │    - Screen capture (screen awareness)      │  │
│  │    - Global input monitoring (rdev)         │  │
│  │    - Multi-monitor detection                │  │
│  │    - System tray (tray-icon)                │  │
│  │    - Auto-launch registration               │  │
│  │                                             │  │
│  │  Data Layer                                 │  │
│  │    - SQLite (state, conversations, memory)  │  │
│  │    - File storage (sprites, config)         │  │
│  │    - Settings CRUD                          │  │
│  │                                             │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 4.3 Data Flow

```
User Interaction Flow:

User clicks pet
  → Frontend sends click event via Tauri IPC
  → Backend PetBehaviorEngine processes event
  → State machine transitions (idle → alert)
  → Backend returns new state + animation
  → Frontend renders new animation

AI Conversation Flow:

User opens chat, types message
  → Frontend sends message via Tauri IPC
  → Backend AgentCore processes:
    1. Load context (personality, memory, recent chat)
    2. Construct prompt with system prompt + context
    3. Call LLM (rig-core) with available tools
    4. Stream response tokens back to frontend
    5. If agent calls tool (e.g., move_to, change_state), execute it
    6. Save conversation to SQLite
    7. Update memory if new facts learned
  → Frontend renders chat bubble with streaming text

Screen Awareness Flow:

Proactive trigger fires (every 15 min)
  → Backend captures screen (screenshots crate)
  → Backend sends screenshot to LLM with context prompt
  → LLM generates comment about screen content
  → Backend sends comment to frontend as chat bubble
  → Pet's animation state changes to "talk"

Care System Flow:

Timer fires every minute
  → Backend CareSystem decays all needs
  → Calculate new mood
  → If mood crosses threshold:
    → Update personality modifiers for LLM prompt
    → Change pet animation behavior (slower when sad, etc.)
    → Trigger proactive behavior (pet complains about hunger)
```

---

## 5. Sprite & Animation Specification

### 5.1 Sprite Sheet Format

Each pet theme contains:
- `spritesheet.png` — Atlas with all frames arranged in a grid
- `animations.json` — Animation definitions

```json
{
  "meta": {
    "frame_width": 64,
    "frame_height": 64,
    "columns": 8
  },
  "animations": {
    "idle": {
      "frames": [0, 1, 2, 3, 4, 3, 2, 1],
      "fps": 8,
      "loop": true,
      "next": null
    },
    "walk_right": {
      "frames": [8, 9, 10, 11, 12, 13],
      "fps": 12,
      "loop": true,
      "next": null
    },
    "sleep": {
      "frames": [24, 25, 26],
      "fps": 4,
      "loop": true,
      "next": null
    }
  },
  "transitions": {
    "idle->walk_right": { "frames": [7], "fps": 12, "loop": false },
    "walk_right->idle": { "frames": [14], "fps": 12, "loop": false }
  }
}
```

### 5.2 Animation States

| State | Description | FPS | Trigger |
|-------|-------------|-----|---------|
| `idle` | Standing, fidgeting | 8 | Default state |
| `walk_left` | Walking left | 12 | Random wander, move_to tool |
| `walk_right` | Walking right | 12 | Random wander, move_to tool |
| `run_left` | Running left | 16 | Chasing/fleeing cursor |
| `run_right` | Running right | 16 | Chasing/fleeing cursor |
| `climb` | Climbing screen edge | 8 | Reached screen edge |
| `fall` | Falling from height | 12 | Released from grab, fell off edge |
| `sleep` | Sleeping | 4 | Idle > 10 min, or energy low |
| `eat` | Eating animation | 8 | Feeding interaction |
| `play` | Playing animation | 10 | Happiness interaction |
| `drag` | Being dragged | 12 | User mouse-down on pet |
| `talk` | Talking animation | 6 | Agent is speaking |
| `happy` | Happy expression | 8 | High mood |
| `sad` | Sad expression | 6 | Low mood |
| `curious` | Looking around | 8 | Cursor nearby |
| `sit` | Sitting down | 6 | Resting state |

### 5.3 State Machine Transitions

```
idle ←→ walk_left ←→ walk_right
idle ←→ sit
idle → sleep (after 10 min idle, or energy < 20%)
idle → curious (cursor within 100px)
idle → talk (agent speaking)
idle → drag (user grabs)
idle → happy (mood > 80%)
idle → sad (mood < 20%)
walk_* → run_* (cursor chase trigger)
walk_* → climb (reached screen edge)
climb → fall (reached top, random chance)
fall → idle (landed on surface)
drag → fall (user releases)
any → idle (catch-all default)
```

---

## 6. AI Agent Specification

### 6.1 LLM Provider Architecture

```
Priority Chain:
  1. User-configured primary provider (e.g., Claude, GPT-4)
  2. User-configured fallback provider (e.g., Ollama local)
  3. Built-in rule-based fallback (no LLM needed)

Provider Support (via rig-core):
  - OpenAI (GPT-4o, GPT-4o-mini)
  - Anthropic (Claude Sonnet, Haiku)
  - Ollama (any local model)
  - OpenAI-compatible APIs (DeepSeek, etc.)
```

### 6.2 Agent Tools

The AI Agent can invoke these tools to control the pet:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `move_to` | `x: f64, y: f64` | Move pet to screen position |
| `change_state` | `state: string` | Change animation state |
| `show_emotion` | `emotion: string` | Display emotion (happy, sad, curious, etc.) |
| `speak` | `text: string` | Show text in chat bubble |
| `capture_screen` | none | Take a screenshot for context |
| `set_timer` | `minutes: u32, message: string` | Set a reminder |
| `remember` | `key: string, value: string` | Store a long-term memory |
| `recall` | `key: string` | Retrieve a long-term memory |
| `change_mood` | `delta: f64` | Adjust pet mood |
| `play_sound` | `sound: string` | Play a sound effect |

### 6.3 System Prompt Template

```
You are {pet_name}, a desktop pet living on {user_name}'s screen.

Personality traits:
- Cheerfulness: {cheerfulness}/100
- Curiosity: {curiosity}/100
- Mischievousness: {mischievousness}/100
- Clinginess: {clinginess}/100

Current state:
- Mood: {mood} ({mood_label})
- Hunger: {hunger}%
- Happiness: {happiness}%
- Energy: {energy}%
- Time: {current_time}
- User activity: {user_activity} (active/idle/{duration} min)

Recent memories:
{recent_memories}

Behavior rules:
- Keep responses short (1-3 sentences for casual chat)
- Use your personality traits to guide your tone
- You can control your body using the available tools
- Comment on what you see on screen when asked
- Suggest breaks if the user has been working for a long time
- Express your needs (hunger, loneliness) naturally in conversation
```

### 6.4 Memory System

**Short-term memory (in-context):**
- Last 20 messages in current conversation
- Current pet state (mood, needs, position)
- Current screen context (if captured)
- Time of day

**Long-term memory (SQLite):**
- User preferences and facts (name, schedule, interests)
- Conversation summaries (auto-generated every 50 messages)
- Key events (first meeting, milestones)
- Interaction statistics (total chat count, total petting count)
- Memory stored as key-value pairs with timestamps
- Searchable by relevance (embedding similarity or keyword match)

### 6.5 Cost Control Strategy

| Layer | Trigger | Cost | Latency |
|-------|---------|------|---------|
| **Rule-based** | Timer events, state transitions | Free | Instant |
| **Local LLM** | Simple chat, proactive comments | Free | 1-5s |
| **Cloud LLM (fast)** | Normal conversation, screen awareness | ~$0.001/turn | 0.5-2s |
| **Cloud LLM (smart)** | Complex reasoning, deep conversation | ~$0.01/turn | 1-3s |

Rate limits:
- Maximum 1 LLM call per 30 seconds for proactive behavior
- No limit on user-initiated conversation
- Screen capture + analysis limited to once per 15 minutes
- Local LLM always preferred for proactive comments

---

## 7. Care System Specification

### 7.1 Needs

| Need | Decay Rate | Min | Max | Critical Threshold | Effect |
|------|-----------|-----|-----|-------------------|--------|
| Hunger | -1.0/hr | 0 | 100 | < 20 | Pet complains, moves slowly |
| Happiness | -0.5/hr | 0 | 100 | < 30 | Pet looks sad, less active |
| Energy | -0.3/hr | 0 | 100 | < 20 | Pet falls asleep, sluggish |
| Social | -0.2/hr | 0 | 100 | < 25 | Pet seeks attention, talks more |

### 7.2 Interactions

| Action | Effect | How |
|--------|--------|-----|
| Feed | Hunger +30 | Right-click menu or drag food item |
| Pet/stroke | Happiness +10 | Click and drag over pet |
| Play | Happiness +20, Energy -10 | Click play button or use toy item |
| Chat | Social +15 | Any conversation exchange |
| Let sleep | Energy +2/min | Leave pet idle for 10+ minutes |

### 7.3 Mood Calculation

```
mood = hunger * 0.3 + happiness * 0.3 + energy * 0.2 + social * 0.2

Mood labels:
  80-100: Ecstatic  (extra bouncy animations, frequent vocalizations)
  60-79:  Happy     (normal behavior)
  40-59:  Neutral   (slightly subdued)
  20-39:  Sad       (slower movement, less proactive)
  0-19:   Miserable (minimal animation, occasional crying)
```

---

## 8. Phased Delivery Plan

### Phase 1 — Skeleton (Week 1-2)

**Goal:** Get a pet on screen with transparent window.

| Task | Details |
|------|---------|
| Tauri v2 project setup | Init Tauri v2 with transparent, frameless, always-on-top window |
| Basic sprite rendering | Canvas 2D sprite sheet loader and renderer |
| Animation loop | RequestAnimationFrame-based animation loop with FPS control |
| Idle animation | Pet stands idle with fidgeting animation |
| Window transparency | Proper alpha compositing for transparent background |
| Click-through | `set_ignore_cursor_events(true)` for transparent areas |

**Verification:**
- [ ] Pet appears on desktop with transparent background
- [ ] Pet animates at target FPS
- [ ] Click events pass through transparent areas
- [ ] Window stays on top of other windows
- [ ] No visible window border or decorations

### Phase 2 — Life (Week 3-4)

**Goal:** Pet can move, interact, and respond to user input.

| Task | Details |
|------|---------|
| State machine | Finite state machine for animation states |
| Movement system | Walk left/right with screen boundary detection |
| Screen edge climbing | Pet can climb left/right screen edges |
| Gravity & falling | Pet falls when released from grab or after climbing |
| Cursor interaction | Pet notices and reacts to cursor proximity |
| Grab & drag | User can click and drag the pet |
| Random wandering | Pet autonomously wanders when idle |
| Window edge detection | Pet can walk on taskbar, sit on window tops |
| Multi-monitor | Pet can traverse between monitors |

**Verification:**
- [ ] Pet walks across the screen autonomously
- [ ] Pet climbs screen edges
- [ ] Pet can be grabbed and dragged
- [ ] Pet falls with gravity when released
- [ ] Pet reacts to cursor proximity
- [ ] Pet respects screen boundaries
- [ ] Pet moves between monitors

### Phase 3 — Mind (Week 5-8)

**Goal:** Pet can think, converse, and remember.

| Task | Details |
|------|---------|
| rig-core integration | Set up agent framework with LLM provider abstraction |
| LLM provider config | Settings UI for API keys, model selection, local LLM setup |
| Chat UI | Text input bubble for conversation |
| Conversation system | Send/receive messages, streaming response display |
| Tool calling | Agent can invoke movement/emotion tools |
| Memory system | Short-term context + long-term SQLite storage |
| System prompt | Dynamic system prompt with personality + state |
| Personality engine | Personality traits that shift based on interactions |
| Proactive speech | Pet speaks on its own based on triggers |
| Ollama integration | Local LLM support as fallback |

**Verification:**
- [ ] User can chat with pet via text input
- [ ] Responses are contextual and personality-appropriate
- [ ] Agent can move the pet using tool calls
- [ ] Conversations persist across app restarts
- [ ] Pet remembers user's name and preferences
- [ ] Pet speaks proactively (greetings, break reminders)
- [ ] Local LLM (Ollama) works as provider
- [ ] Cloud API (OpenAI/Anthropic) works as provider
- [ ] Fallback chain works (cloud → local → rules)

### Phase 4 — Soul (Week 9-12)

**Goal:** Pet has needs, awareness, and depth.

| Task | Details |
|------|---------|
| Care system | Need decay, interaction rewards, mood calculation |
| Care UI | Need bars, feed/play buttons, status indicators |
| Screen awareness | Periodic screen capture + LLM analysis |
| Screen awareness UI | Pet comments on screen content |
| Behavior scheduler | Time-based triggers (morning greeting, break reminder) |
| Activity detection | Detect user idle/active state |
| Sound effects | Basic vocalizations (happy, sad, hungry sounds) |
| Personality growth | Long-term personality evolution based on interaction patterns |

**Verification:**
- [ ] Needs decay over time visibly
- [ ] Feeding/petting/chatting replenishes needs
- [ ] Mood affects pet animation and behavior
- [ ] Pet can describe what's on screen
- [ ] Pet greets in morning, says goodnight
- [ ] Pet reminds about breaks after long work sessions
- [ ] Sound effects play at appropriate times
- [ ] Personality evolves over multiple sessions

### Phase 5 — Polish (Week 13-16)

**Goal:** Production-ready application.

| Task | Details |
|------|---------|
| System tray | Minimize to tray, tray menu (show/hide, settings, quit) |
| Settings UI | Full settings panel (LLM, appearance, behavior, shortcuts) |
| Auto-launch | Register/unregister OS startup |
| Custom pet themes | Load external sprite sheet + animation JSON |
| Onboarding | First-run setup wizard (name pet, choose appearance, configure LLM) |
| Auto-update | Tauri built-in updater |
| Packaging | Windows installer (.msi), macOS .dmg |
| Performance optimization | Minimize CPU/GPU usage, efficient animation scheduling |
| Error handling | Graceful LLM failures, offline mode, corrupted data recovery |
| Accessibility | Keyboard navigation, screen reader support for settings |

**Verification:**
- [ ] App installs and runs on Windows 10/11
- [ ] App installs and runs on macOS 12+
- [ ] System tray works on both platforms
- [ ] Settings persist across restarts
- [ ] Custom pet themes load correctly
- [ ] First-run onboarding guides user through setup
- [ ] Auto-update detects and installs new versions
- [ ] App uses < 50MB RAM at idle, < 5% CPU
- [ ] Works offline (rule-based behavior only)
- [ ] Recovers gracefully from LLM API errors

---

## 9. Technical Verification Plan

### 9.1 Phase 1 Verification Steps

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 1 | Transparent window on Windows | Manual | No visible background, pet sprites show correctly |
| 2 | Transparent window on macOS | Manual | Same as above on macOS |
| 3 | Always-on-top | Manual | Pet stays above all other windows |
| 4 | Click-through on transparent areas | Automated test | Mouse events pass through to windows below pet |
| 5 | Click detection on pet | Automated test | Mouse click on non-transparent pixels registers |
| 6 | Animation FPS | Automated test | Achieves target FPS consistently |
| 7 | Memory usage | Profiling | < 30MB RAM at idle |
| 8 | Binary size | Build check | < 10MB release binary |

### 9.2 Phase 2 Verification Steps

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 1 | Walk animation sync | Visual | Sprite frames match movement speed |
| 2 | Screen boundary collision | Automated | Pet doesn't walk off-screen |
| 3 | Grab and drag | Manual | Pet follows cursor while dragged |
| 4 | Gravity simulation | Automated | Pet falls at consistent rate |
| 5 | State transitions | Unit tests | All defined transitions work correctly |
| 6 | Multi-monitor crossing | Manual | Pet can walk from one monitor to another |
| 7 | Cursor proximity reaction | Automated | Pet enters "curious" state when cursor within 100px |

### 9.3 Phase 3 Verification Steps

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 1 | LLM connection (OpenAI) | Integration test | Sends message, receives response |
| 2 | LLM connection (Anthropic) | Integration test | Sends message, receives response |
| 3 | LLM connection (Ollama) | Integration test | Sends message, receives response |
| 4 | Streaming response | Manual | Chat text appears token by token |
| 5 | Tool calling | Integration test | Agent calls move_to tool, pet moves |
| 6 | Conversation persistence | Integration test | Messages saved to SQLite, reloadable |
| 7 | Memory recall | Integration test | Pet remembers facts across conversations |
| 8 | Fallback chain | Integration test | Cloud → local → rules fallback works |
| 9 | Rate limiting | Integration test | No more than 1 proactive call per 30s |
| 10 | Persona consistency | Manual review | Responses match configured personality |

### 9.4 Phase 4 Verification Steps

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 1 | Need decay | Unit test | Needs decrease at specified rates |
| 2 | Mood calculation | Unit test | Mood correctly computed from needs |
| 3 | Mood → behavior | Integration test | Low mood causes sad animation |
| 4 | Screen capture | Integration test | Screenshot taken and sent to LLM |
| 5 | Screen commentary | Manual | Pet makes relevant comments about screen |
| 6 | Scheduled triggers | Integration test | Morning greeting fires between 8-9am |
| 7 | Idle detection | Integration test | Detects 5+ min of no input |
| 8 | Sound effects | Manual | Sounds play at correct moments |

### 9.5 Phase 5 Verification Steps

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 1 | System tray (Windows) | Manual | Tray icon appears, menu works |
| 2 | System tray (macOS) | Manual | Tray icon appears, menu works |
| 3 | Auto-launch (Windows) | Manual | App starts with Windows after enabling |
| 4 | Auto-launch (macOS) | Manual | App starts with macOS after enabling |
| 5 | Custom theme loading | Integration test | External spritesheet + JSON loads correctly |
| 6 | Auto-update | Manual | Detects new version, downloads, installs |
| 7 | Windows installer | Manual | .msi installs, runs, uninstalls cleanly |
| 8 | macOS installer | Manual | .dmg installs, runs, uninstalls cleanly |
| 9 | Performance at idle | Profiling | < 50MB RAM, < 5% CPU |
| 10 | Performance with active LLM | Profiling | < 200MB RAM, < 15% CPU |
| 11 | Offline operation | Manual | App works without internet (rule-based only) |
| 12 | LLM error recovery | Integration test | Graceful fallback when API fails |

---

## 10. Technology Stack Detailed Evaluation

### 10.1 Why Tauri v2

| Factor | Assessment |
|--------|-----------|
| Transparent window | Supported via `transparent: true` in tauri.conf.json |
| Always-on-top | Supported via `alwaysOnTop: true` |
| Frameless | Supported via `decorations: false` |
| Click-through | Supported via `set_ignore_cursor_events(true)` |
| Cross-platform | Windows (WebView2), macOS (WKWebView), Linux (WebKitGTK) |
| Binary size | 3-10MB (vs Electron's 100MB+) |
| System tray | Built-in support |
| Auto-update | Built-in updater |
| Community | 90k+ GitHub stars, active development |
| Desktop pet precedent | CrabNebula official tutorial, Moocha project, BongoCat |

### 10.2 Why rig-core

| Factor | Assessment |
|--------|-----------|
| LLM providers | 20+ providers including OpenAI, Anthropic, Ollama |
| Tool calling | Native support for agent tool use |
| Streaming | Built-in streaming response support |
| Maturity | v0.34.0, actively maintained by 0xPlaygrounds |
| Rust-native | No FFI, pure Rust |

### 10.3 Why Canvas 2D (with optional WebGPU)

| Factor | Assessment |
|--------|-----------|
| Sprite rendering | Canvas 2D handles 1-50 sprites at 60FPS trivially |
| Cross-platform | Works in all webview engines |
| Simplicity | No GPU context setup, no shader compilation |
| Fallback | WebGPU available on Windows WebView2 for future effects |
| macOS WebGPU | Safari 26+ supports it, but Canvas 2D is the reliable baseline |

### 10.4 Alternative Technologies Considered and Rejected

| Technology | Why Rejected |
|-----------|-------------|
| egui_overlay | Immature, limited animation support, not cross-platform reliable for transparent windows |
| wgpu native (dual-window with Tauri) | Unsolved flickering bug (#9220), 3-5x complexity for zero measurable perf gain |
| skia-safe | 50-100MB binary size increase for capabilities not needed for sprite rendering |
| Bevy (full engine) | Overkill for desktop pet; includes 3D renderer, audio engine, asset pipeline we don't need |
| iced/Slint/Druid | Cannot do transparent overlay windows reliably |
| langchain-rust | Less mature than rig-core, fewer providers |
| Electron | 100MB+ binary, high resource usage, defeats the purpose of using Rust |

---

## 11. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Binary size | < 10MB (compressed installer) |
| RAM usage (idle) | < 50MB |
| RAM usage (active LLM call) | < 200MB |
| CPU usage (idle animation) | < 5% |
| CPU usage (active LLM call) | < 15% |
| Cold start time | < 3 seconds |
| Animation latency | < 16ms per frame (60 FPS) |
| LLM response latency | < 3 seconds (first token) |
| Conversation storage | SQLite, < 100MB after 1 year of use |
| Offline support | Full behavior (rule-based), conversation requires LLM |
| Crash recovery | Pet state auto-saved every 30 seconds |
| Supported OS | Windows 10+, macOS 12+ |

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Transparent window issues on macOS | Medium | High | Fallback to non-transparent mode; test on real hardware early |
| WebGPU not available on older macOS | High | Low | Canvas 2D is the baseline; WebGPU is optional acceleration |
| LLM API costs spiral | Medium | Medium | Rate limiting; local LLM default; cost dashboard in settings |
| Click-through not working on some windows managers | Low | High | Platform-specific workarounds documented in Tauri issues |
| rdev permissions on macOS | High | Medium | macOS requires accessibility permissions; clear onboarding prompt |
| Sprite animation jank | Low | Medium | Frame timing with requestAnimationFrame; adaptive FPS |
| Memory leaks in long-running sessions | Medium | High | Periodic state serialization; runtime memory profiling |

---

## 13. Project Structure (Proposed)

```
ditto/
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs              # Tauri app entry
│   │   ├── agent/               # AI Agent modules
│   │   │   ├── mod.rs
│   │   │   ├── core.rs          # rig-core setup, provider chain
│   │   │   ├── tools.rs         # Tool definitions (move_to, speak, etc.)
│   │   │   ├── memory.rs        # Short/long-term memory
│   │   │   ├── personality.rs   # Personality trait engine
│   │   │   └── prompt.rs        # System prompt builder
│   │   ├── behavior/            # Pet behavior modules
│   │   │   ├── mod.rs
│   │   │   ├── state_machine.rs # Finite state machine
│   │   │   ├── scheduler.rs     # Behavior trigger scheduler
│   │   │   ├── movement.rs      # Movement, gravity, physics
│   │   │   └── cursor.rs        # Cursor awareness
│   │   ├── care/                # Care system modules
│   │   │   ├── mod.rs
│   │   │   ├── needs.rs         # Need decay and replenishment
│   │   │   └── mood.rs          # Mood calculation
│   │   ├── system/              # System integration
│   │   │   ├── mod.rs
│   │   │   ├── tray.rs          # System tray
│   │   │   ├── input.rs         # Global input monitoring
│   │   │   ├── screen.rs        # Screen capture
│   │   │   ├── monitor.rs       # Multi-monitor detection
│   │   │   └── autolaunch.rs    # OS auto-launch
│   │   ├── db/                  # Data layer
│   │   │   ├── mod.rs
│   │   │   ├── migrations.rs    # SQLite migrations
│   │   │   └── models.rs        # Data models
│   │   └── commands/            # Tauri IPC commands
│   │       ├── mod.rs
│   │       ├── pet.rs           # Pet state commands
│   │       ├── chat.rs          # Chat/agent commands
│   │       ├── care.rs          # Care system commands
│   │       └── settings.rs      # Settings commands
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                          # Frontend (web)
│   ├── main.ts                  # Entry point
│   ├── renderer/                # Sprite rendering
│   │   ├── sprite-engine.ts     # Sprite sheet loader & renderer
│   │   ├── animation.ts         # Animation state machine
│   │   └── canvas.ts            # Canvas setup & compositing
│   ├── ui/                      # UI components
│   │   ├── chat-bubble.ts       # AI conversation bubble
│   │   ├── care-panel.ts        # Need bars & care buttons
│   │   ├── settings.ts          # Settings panel
│   │   ├── onboarding.ts        # First-run wizard
│   │   └── name-tag.ts          # Pet name tag
│   ├── input/                   # Input handling
│   │   ├── drag.ts              # Grab & drag handler
│   │   └── click.ts             # Click detection
│   └── ipc/                     # Tauri IPC bindings
│       └── commands.ts          # Typed IPC command wrappers
├── assets/
│   ├── pets/                    # Default pet sprites
│   │   └── default/
│   │       ├── spritesheet.png
│   │       └── animations.json
│   └── sounds/                  # Sound effects
├── doc/
│   └── PRD.md                   # This document
└── README.md
```

---

## 14. Open Questions

None — all design decisions resolved through research and user discussion.

---

## Appendix A: Reference Projects

| Project | Language | What We Learned |
|---------|----------|----------------|
| [Moocha](https://github.com/nicepkg/moocha) | Rust + Tauri | AI desktop pet with Rust backend; validates our tech stack |
| [BongoCat](https://github.com/ayangweb/bongocat) | Rust + Tauri | Cross-platform desktop pet; Tauri transparent window patterns |
| [CrabNebula Tutorial](https://crabnebula.dev/blog/building-a-desktop-pet-with-tauri/) | Tauri | Official desktop pet tutorial; click-through, sprite rendering |
| [VPet-Simulator](https://github.com/LorisYounger/VPet) | C#/.NET | Feature-rich desktop pet; Steam Workshop, ChatGPT integration |
| [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | Python | AI desktop companion; memory system, screen awareness patterns |
| [Shimeji-ee](https://github.com/gil/shimeji-ee) | Java | Classic desktop pet; behavior XML format, community sprites |

## Appendix B: Key Crate Versions

| Crate | Version | Purpose |
|-------|---------|---------|
| tauri | 2.x | App framework |
| rig-core | 0.34+ | AI agent framework |
| rusqlite | 0.32+ | SQLite database |
| tray-icon | 0.19+ | System tray |
| rdev | 0.5+ | Global input monitoring |
| screenshots | 0.7+ or xcap | Screen capture |
| serde + serde_json | 1.x | Serialization |
| tokio | 1.x | Async runtime |
