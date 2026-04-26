# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ditto is an agent-driven desktop pet built with **Rust + Tauri v2**. An animated creature lives on a transparent overlay window, with behavior governed by an AI agent (rig-core) rather than scripts. All five phases are complete: skeleton rendering, physics/interaction, AI agent/chat/memory, care system/mood, and system tray/settings/packaging.

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
- `commands/mod.rs` — 13 IPC commands (see below)
- `agent/core.rs` — LLM provider config (OpenAI, Anthropic, Ollama), agent construction, rate limiting, rule-based fallback. 19 tests.
- `agent/memory.rs` — Short-term (sliding window) and long-term (key-value) memory with DB persistence. 6 tests.
- `agent/personality.rs` — Personality traits (cheerfulness, curiosity, mischievousness, clinginess) with shift mechanics and persistence. 12 tests.
- `agent/prompt.rs` — System prompt builder with personality, mood, needs, memories, time context. 9 tests.
- `agent/tools.rs` — LLM tool definitions: move_to, change_state, show_emotion, speak, remember, recall. 12 tests.
- `behavior/state_machine.rs` — 16-state `PetState` FSM with context-aware transitions. 28 tests.
- `behavior/movement.rs` — `PetPhysics` with position/velocity, screen boundary clamping, gravity (980 px/s²), ground detection. 9 tests.
- `behavior/cursor.rs` — Euclidean distance calculation for proximity detection. 7 tests.
- `behavior/scheduler.rs` — Activity detection, scheduled triggers (morning greeting, break reminder, idle comments). 15 tests.
- `care/needs.rs` — Pet needs (hunger, happiness, energy, social) with decay rates, mood scoring, care actions. 21 tests.
- `db/mod.rs` — SQLite operations for conversations, messages, memory, settings. 10 tests.
- `db/migrations.rs` — Schema migrations. 2 tests.
- `system/tray.rs` — System tray icon with show/hide, settings, quit menu
- `system/autolaunch.rs` — Auto-launch registration
- `system/themes.rs` — Theme discovery from data directory. 2 tests.
- `system/screen.rs` — Primary monitor screen capture. 2 tests.

The `commands` module is gated with `#[cfg(not(test))]` because Tauri runtime dependencies (WebView2) crash the test harness. Tests verify command registration by reading source files as strings.

### IPC Commands (13 total)

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
| `list_themes` | List available pet themes |

### Frontend (TypeScript, `src/`)

#### Overlay Window (`src/overlay/`, vanilla TS, entry: `index.html`)

- `main.ts` — Bootstraps SpriteEngine, PetController, ClickThroughHandler, DragHandler
- `setup-events.ts` — Pet action listener, settings listener, activity tracking, scheduler tick
- `behavior/pet-controller.ts` — State management, physics, FSM integration via `transitionPetState` IPC, cursor distance tracking
- `renderer/sprite-engine.ts` — Canvas 2D sprite loader and render loop
- `renderer/animation.ts` — `AnimationPlayer` with FPS-controlled frame sequencing
- `input/click-through.ts` — Pixel-alpha click-through detection, cursor distance for FSM context
- `input/drag-handler.ts` — Per-pixel mousedown, mousemove drag, gravity release

#### UI Windows (`src/`, Vue 3, entry: `ui.html`)

- `main.ts` — Vue app bootstrap
- `composables/useChat.ts` — Chat with streaming token display
- `composables/useCare.ts` — Care panel with need bars, mood display, action buttons
- `composables/useTauriEvents.ts` — Tauri event listener composable
- `windows/chat-bubble.ts` — Chat window management
- `windows/care-panel.ts` — Care panel window
- `windows/settings.ts` — Settings window (LLM config, pet name, auto-launch)
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
- Dev: `rstest 0.18` (parameterized tests)

## Test Suite

222 tests total, all must pass:
- 16 config/tray/animation/db tests in `lib.rs`
- 28 FSM transition tests in `behavior/state_machine.rs`
- 15 scheduler tests in `behavior/scheduler.rs`
- 9 physics tests in `behavior/movement.rs`
- 7 cursor proximity tests in `behavior/cursor.rs`
- 19 agent core tests + 18 agent integration/error/tool tests
- 6 memory + 12 personality + 9 prompt + 12 tools tests
- 21 care needs tests in `care/needs.rs`
- 12 database tests (db/mod.rs + migrations.rs)
- 4 system tests (screen + themes)

## Implementation Harness

The project uses a long-running TDD harness driven by the `/ditto-implement` Claude Code skill. The harness manages phased implementation (5 phases, 58 features total) with state persisted in `ditto-harness/`.

**Phases:**
1. **Skeleton** ✅ — Transparent window, sprite rendering, pet on screen
2. **Life** ✅ — State machine, movement, physics, cursor interaction, drag & drop
3. **Mind** ✅ — AI agent, chat, memory, multi-provider LLM (Ollama/OpenAI/Anthropic)
4. **Soul** ✅ — Care system, screen awareness, mood-driven behavior
5. **Polish** ✅ — System tray, settings, packaging, performance

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
