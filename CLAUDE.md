# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ditto is an agent-driven desktop pet built with **Rust + Tauri v2**. An animated creature lives on a transparent overlay window, with behavior governed by an AI agent (rig-core) rather than scripts. Eight phases are complete: skeleton rendering, physics/interaction, AI agent/chat/memory, care system/mood, system tray/settings/packaging, skin foundation (multi-renderer architecture, skin distribution, unified Pet Manager UI), interaction foundation (InteractionRouter, 7 interaction modes, bond engine, interaction profiles), and depth & cozy loop (Live2D renderer, mini-games, letters, journal, dream nail, chat log, command input).

## Build & Development Commands

```bash
# Install frontend dependencies
npm install

# Run in dev mode (starts Vite + Rust backend)
npx tauri dev

# Run all Rust tests
cargo test --manifest-path src-tauri/Cargo.toml

# Run a single test (supports substring matching)
cargo test --manifest-path src-tauri/Cargo.toml <test_name>

# Format check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check

# Auto-format
cargo fmt --manifest-path src-tauri/Cargo.toml

# Lint (must pass with zero warnings)
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# TypeScript type check
npx tsc --noEmit

# Frontend build
npx vite build

# Release build
cargo build --manifest-path src-tauri/Cargo.toml --release
```

All Rust commands require `--manifest-path src-tauri/Cargo.toml` because `Cargo.toml` lives in `src-tauri/`, not the project root.

## Code Style

- **Rust**: Follow `rustfmt` defaults + `clippy` recommendations. No warnings allowed (`-D warnings`).
- **TypeScript**: 2-space indent, semicolons, single quotes.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) format.

## Architecture

Tauri v2 app with Rust backend and web frontend communicating via Tauri IPC commands.

### Backend (Rust, `src-tauri/src/`)

- `main.rs` — Entry point, delegates to `ditto_lib::run()`
- `lib.rs` — Tauri builder with command registration, env loading, and DB initialization
- `commands/mod.rs` — 34 IPC commands (see below)
- `agent/core.rs` — LLM provider config (OpenAI, Anthropic, Ollama), agent construction, rate limiting, rule-based fallback. 19 tests.
- `agent/generation.rs` — Agent generation extensions: inner thought, letter, journal prompts with rule-based fallbacks
- `agent/memory.rs` — Short-term (sliding window) and long-term (key-value) memory with DB persistence. 6 tests.
- `agent/personality.rs` — Personality traits (cheerfulness, curiosity, mischievousness, clinginess) with shift mechanics and persistence. 12 tests.
- `agent/prompt.rs` — System prompt builder with personality, mood, needs, memories, time context. 9 tests.
- `agent/tools.rs` — LLM tool definitions: move_to, change_state, show_emotion, speak, remember, recall. 12 tests.
- `behavior/state_machine.rs` — 16-state `PetState` FSM with context-aware transitions. 28 tests.
- `behavior/movement.rs` — `PetPhysics` with position/velocity, screen boundary clamping, gravity (980 px/s²), ground detection. 9 tests.
- `behavior/cursor.rs` — Euclidean distance calculation for proximity detection. 7 tests.
- `behavior/scheduler.rs` — Activity detection, scheduled triggers (morning greeting, break reminder, idle comments). 15 tests.
- `care/needs.rs` — Pet needs (hunger, happiness, energy, social) with decay rates, mood scoring, care actions. 21 tests.
- `care/bond.rs` — 10-level bond engine with threshold table, daily caps per action type, SQLite persistence. 13 tests.
- `care/minigame.rs` — Mini-game backend (RPS + CatchTheFood) with care effects
- `db/mod.rs` — SQLite operations for conversations, messages, memory, settings, letters, journal, game results. 17 tests.
- `db/models.rs` — DB models for letters, journal entries, mini-game results
- `db/migrations.rs` — Schema migrations (conversations, messages, memory, settings, letters, journal_entries, mini_game_results). 2 tests.
- `system/tray.rs` — System tray icon with show/hide, Pet Manager, quit menu
- `system/autolaunch.rs` — Auto-launch registration
- `system/skins.rs` — Skin discovery, import (zip/url), deletion, catalog. 11 tests.
- `system/screen.rs` — Primary monitor screen capture. 2 tests.

The `commands` module is gated with `#[cfg(not(test))]` because Tauri runtime dependencies (WebView2) crash the test harness. Tests verify command registration by reading source files as strings.

### IPC Commands (34 total)

| Command | Purpose |
|---------|---------|
| `set_ignore_cursor_events` | Toggle click-through on pet window |
| `get_cursor_position` | Get cursor position in screen coordinates |
| `set_window_position` | Move window to x,y coordinates |
| `send_chat_message` | Send message to LLM, stream response via events |
| `load_chat_history` | Load recent conversation messages from DB |
| `get_care_state` | Get current pet needs and mood |
| `apply_care_action` | Apply care action (feed, pet, chat, sleep) |
| `check_scheduled_triggers` | Check and fire scheduled behavior triggers |
| `record_user_activity` | Record activity for idle detection |
| `get_settings` / `save_settings` | Load/save application settings |
| `transition_pet_state` | Request FSM state transition with context |
| `list_skins` | List available skin IDs |
| `list_skins_catalog` | Full catalog with metadata (name, renderer, source, path) |
| `import_skin_zip` | Validate and install skin from local zip |
| `import_skin_url` | Download and install skin from URL |
| `delete_skin` | Remove user-installed skin |
| `get_active_skin` / `set_active_skin` | Load/save active skin selection |
| `get_bond_state` | Get current bond level and total points |
| `award_bond_points` | Award bond points for an action, emit level-up event |
| `get_pending_letters` | Get unread letters from pet |
| `mark_letter_read` | Mark a letter as read |
| `send_letter_reply` | Reply to a letter from pet |
| `get_letter_archive` | Get paginated letter archive |
| `get_journal_entries` | Get journal entries by date range |
| `generate_journal_entry` | Generate journal entry via agent pipeline |
| `start_mini_game` | Start a mini-game session (RPS or Catch) |
| `submit_mini_game_result` | Submit game result, apply care effects |
| `get_game_history` | Get paginated mini-game history |
| `generate_inner_thought` | Generate pet's inner thought via agent |
| `get_dream_nail_uses` | Get today's dream nail usage count |
| `list_memories` | List all memories with optional category filter |
| `get_personality` | Get current personality traits |

### Frontend (TypeScript, `src/`)

#### Overlay Window (`src/overlay/`, vanilla TS, entry: `index.html`)

- `main.ts` — Bootstraps SpriteEngine, PetController, ClickThroughHandler, DragHandler, InteractionRouter
- `setup-events.ts` — Pet action listener, settings listener, activity tracking, scheduler tick with InteractionRouter wiring
- `behavior/pet-controller.ts` — State management, physics, FSM integration via `transitionPetState` IPC, cursor distance tracking
- `renderer/sprite-engine.ts` — Canvas 2D sprite loader and render loop
- `renderer/animation.ts` — `AnimationPlayer` with FPS-controlled frame sequencing
- `renderer/pet-renderer.ts` — `PetRenderer` interface, `SkinManifest` type, capability type guards
- `renderer/sprite-renderer.ts` — `SpriteRenderer` implementing `PetRenderer`
- `renderer/spine-renderer.ts` — `SpineRenderer` implementing `PetRenderer` (via `@esotericsoftware/spine-canvas`)
- `renderer/live2d-renderer.ts` — `Live2DRenderer` implementing `PetRenderer` + `LipSyncable` + `Expressible` (via `pixi-live2d-display`)
- `renderer/renderer-factory.ts` — Creates correct renderer from skin manifest type (sprite, spine, live2d)
- `renderer/skin-manifest.ts` — `validateSkinManifest()` for required field checks
- `input/click-through.ts` — Pixel-alpha click-through detection, cursor distance for FSM context
- `input/drag-handler.ts` — Per-pixel mousedown, mousemove drag, gravity release

#### Interaction System (`src/overlay/interaction/`)

- `interaction-router.ts` — Central dispatch with mode registry, gesture mapping, outbound/inbound buses, compatibility enforcement (MUTUALLY_EXCLUSIVE_GROUPS, ALWAYS_CONCURRENT)
- `types.ts` — SystemOutput and InteractionEvent discriminated unions, InteractionMode interface, GestureType
- `profile-manager.ts` — Minimal/Nurture/RPG profile presets with mode enable/disable and gesture mapping
- `modes/bark-mode.ts` — DOM overlay bark bubbles: typewriter effect, auto-fade, queue cap 3
- `modes/thought-bubble-mode.ts` — Emoji icons for critical care needs with red border pulse
- `modes/speech-bubble-mode.ts` — Comic-style DOM bubble with streaming text and quick-reply chips
- `modes/radial-menu-mode.ts` — SVG ring with 4 segments (Feed/Play/Sleep/Chat), hover highlight
- `modes/emote-wheel-mode.ts` — Grid wheel with 4 emotes, emote-to-FSM-state mapping
- `modes/touch-zone-mode.ts` — Zone-based touch detection from skin.json rects
- `modes/dialog-panel-mode.ts` — Delegates to Pet Manager /chat route
- `modes/bond-indicator-mode.ts` — Lv.N + heart progress bar, level-up ceremony overlay
- `modes/dream-nail-mode.ts` — Peek into pet's inner thoughts with bond gating (Lv.3+) and daily use limit
- `modes/letter-mode.ts` — Send/receive letters with pet, bond gating (Lv.2+), envelope notification
- `modes/journal-mode.ts` — Pet journal entries with calendar view, bond gating (Lv.4+), date-range queries
- `modes/chat-log-mode.ts` — Overlay recent 3 chat log entries with auto-fade
- `modes/command-input-mode.ts` — Slash command input with `/think`, `/letter`, `/journal` parsing and autocomplete
- `modes/mini-game-mode.ts` — Overlay interaction for RPS + Catch-the-Food games

#### UI Windows (`src/`, Vue 3, entry: `ui.html`)

- `main.ts` — Vue app bootstrap
- `composables/useChat.ts` — Chat with streaming token display
- `composables/useCare.ts` — Care panel with need bars, mood display, action buttons
- `composables/useTauriEvents.ts` — Tauri event listener composable
- `composables/useLetters.ts` — Letter composable with pending/archive/reply
- `composables/useJournal.ts` — Journal composable with date-range queries
- `composables/useChatLog.ts` — ChatLog composable with multi-tab architecture
- `windows/pet-manager.ts` — Unified Pet Manager window launcher
- `windows/chat-bubble.ts` — Delegates to Pet Manager (/chat route)
- `windows/care-panel.ts` — Delegates to Pet Manager (/care route)
- `windows/settings.ts` — Delegates to Pet Manager (/settings route)
- `windows/onboarding.ts` — First-run setup wizard
- `sound.ts` — Procedural Web Audio API synthesis for pet sounds

#### Shared

- `ipc/commands.ts` — Tauri IPC command wrappers
- `types/pet-state.ts` — PetState type (16 states)
- `types/care.ts` — CareState, CareNeeds, CareAction types

### Frontend-Backend State Management

The Rust FSM is wired to the frontend via `transition_pet_state` IPC. The frontend passes FSM context (cursor distance, idle time, energy, mood) and the backend validates state transitions. Physical states (drag, fall, idle) bypass FSM for zero-latency response; all other transitions go through the FSM.

### Sound System

- Sound effects use procedural Web Audio API synthesis (`src/sound.ts`) — no audio files needed
- For future sampled audio (voice lines, richer effects), switch to `rodio` crate in the Rust backend

### Asset Pipeline

- `public/` is Vite's `publicDir` — files are served at root (e.g., `/pets/default/spritesheet.png`)
- Sprite format: PNG atlas + `animations.json` defining frame sequences, FPS, and transitions
- Current spritesheet: 512x64px, 8 columns, 64x64 frames
- All 16 PetState animations defined: idle, walk_left, walk_right, run_left, run_right, climb, fall, drag, sleep, eat, play, talk, happy, sad, curious, sit

### Key Dependencies

- `tauri 2.x` (app framework, with tray-icon, image-png features), `serde` + `serde_json` (serialization)
- `rig-core 0.35` (AI agent — OpenAI, Anthropic, Ollama), `rusqlite 0.32` (SQLite, bundled), `tokio 1` (async runtime)
- `xcap 0.6` (screen capture), `auto-launch 0.6` (startup registration), `chrono 0.4` (time)
- `zip 2` (skin archive extraction), `reqwest 0.12` (skin download, blocking feature)
- `@esotericsoftware/spine-canvas 4.2` (Spine skeletal animation runtime)
- `pixi.js 6.5` + `pixi-live2d-display 0.4` (Live2D WebGL renderer)
- Dev: `rstest 0.18` (parameterized tests), `tempfile 3` (integration test dirs), `vitest` + `jsdom` (TS unit tests)

## Test Suite

315 Rust tests + ~312 TypeScript tests, all must pass:
- 16 config/tray/animation/db tests in `lib.rs`
- 28 FSM transition tests in `behavior/state_machine.rs`
- 15 scheduler tests in `behavior/scheduler.rs`
- 9 physics tests in `behavior/movement.rs`
- 7 cursor proximity tests in `behavior/cursor.rs`
- 19 agent core tests + 18 agent integration/error/tool tests
- Agent generation tests (inner thought, letter, journal prompts)
- 6 memory + 12 personality + 9 prompt + 12 tools tests
- 21 care needs tests in `care/needs.rs`
- 13 bond engine tests in `care/bond.rs`
- Mini-game logic tests in `care/minigame.rs`
- 17 database tests (db/mod.rs — conversations, memory, settings, letters, journal, game results)
- 2 migration tests in `db/migrations.rs`
- 11 system tests (screen + skins, including import/export/catalog/deletion)
- 6 renderer TypeScript test suites (pet-renderer, sprite-renderer, spine-renderer, live2d-renderer, renderer-factory, skin-manifest)
- 14 interaction TypeScript test suites (interaction-router, profile-manager, bark-mode, thought-bubble, speech-bubble, radial-menu, emote-wheel, bond-indicator, dream-nail, letter, journal, chat-log, command-input, mini-game)

## Implementation Harness

The project uses a long-running TDD harness driven by the `/ditto-implement` Claude Code skill. The harness manages phased implementation (8 phases complete) with state persisted in `ditto-harness/`.

**Phases:**
1. **Skeleton** ✅ — Transparent window, sprite rendering, pet on screen
2. **Life** ✅ — State machine, movement, physics, cursor interaction, drag & drop
3. **Mind** ✅ — AI agent, chat, memory, multi-provider LLM (Ollama/OpenAI/Anthropic)
4. **Soul** ✅ — Care system, screen awareness, mood-driven behavior
5. **Polish** ✅ — System tray, settings, packaging, performance
6. **Skin Foundation** ✅ — Multi-renderer architecture, skin distribution, unified Pet Manager
7. **Interaction Foundation** ✅ — InteractionRouter, 7 interaction modes, bond engine, interaction profiles
8. **Depth & Cozy Loop** ✅ — Live2D renderer, mini-games, letters, journal, dream nail, chat log, command input

**Harness invariants:**
- All tests must pass before starting new work
- TDD: write failing test → implement → refactor
- One feature at a time; incremental progress is the goal
- Phase gates require evaluator subagent approval
- Never modify feature ids, descriptions, or steps in feature-list.json — only `passes` and `commit`

## Key Files

- `docs/PRD.md` — Full product specification (architecture, features, data models, phased plan)
- `ditto-harness/ditto-progress.json` — Current phase and feature completion state
- `ditto-harness/phase-{N}/feature-list.json` — Per-phase feature tracking with pass/fail status
- `ditto-harness/phase-{N}/phase-eval-report.md` — Phase evaluation reports

## Known Issues

- **P1-002 deferred**: macOS transparent window verification requires physical hardware
- **Click-through is polling-based**: 50ms interval cursor checks instead of event-driven (to be improved with `rdev` in future)
- **Screen edge climbing not implemented**: FSM supports climb transitions but no runtime climbing physics in frontend

## CI

GitHub Actions runs on push/PR to `main`: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `cargo check`. All Rust commands use `--manifest-path src-tauri/Cargo.toml`.
