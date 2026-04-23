# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ditto is an agent-driven desktop pet built with **Rust + Tauri v2**. An animated creature lives on a transparent overlay window, with behavior governed by an AI agent (rig-core) rather than scripts. Phases 1–2 are complete. The app renders a sprite on a transparent frameless window with movement, gravity, drag-and-drop, cursor interaction, and multi-monitor support.

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
cargo fmt --manifest-path src-tauri/Cargo.toml --check

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
- `lib.rs` — Tauri builder with command registration + config/animation tests (11 tests, gated behind `#[cfg(test)]`)
- `commands/mod.rs` — IPC commands: `set_ignore_cursor_events`, `get_cursor_position`, `set_window_position`
- `behavior/state_machine.rs` — 16-state `PetState` FSM with context-aware transitions (energy, mood, cursor distance, idle time). 33 tests.
- `behavior/movement.rs` — `PetPhysics` with position/velocity, screen boundary clamping, gravity (980 px/s²), and ground detection. 16 tests.
- `behavior/cursor.rs` — Euclidean distance calculation between pet center and cursor for proximity detection. 7 tests.

The `commands` module is gated with `#[cfg(not(test))]` because Tauri runtime dependencies (WebView2) crash the test harness. Tests verify command registration by reading source files as strings. The `behavior` module is NOT gated — it's pure logic testable without the Tauri runtime.

### Frontend (TypeScript, `src/`)

- `main.ts` — Bootstraps SpriteEngine, PetController, ClickThroughHandler, and DragHandler
- `behavior/pet-controller.ts` — State management, window movement, autonomous wandering, gravity/falling, drag handling. Owns the pet's x/y position and drives `set_window_position` IPC.
- `renderer/sprite-engine.ts` — Canvas 2D sprite loader and requestAnimationFrame render loop, delegates to AnimationPlayer and PetController each frame
- `renderer/animation.ts` — `AnimationPlayer` class with FPS-controlled frame sequencing, looping, transitions
- `input/click-through.ts` — Polls cursor position every 50ms, checks pixel alpha, toggles `set_ignore_cursor_events`
- `input/drag-handler.ts` — Per-pixel mousedown detection, tracks mousemove for drag, releases to fall state

### Frontend-Backend Split

The Rust FSM (`state_machine.rs`) is well-tested but currently not wired to the frontend at runtime — the frontend `PetController` manages state unilaterally. Phase 3 will integrate the backend FSM via IPC when the AI agent drives behavior.

### Sound System

- Sound effects use procedural Web Audio API synthesis (`src/ui/sound.ts`) — no audio files needed
- For future sampled audio (voice lines, richer effects), switch to `rodio` crate in the Rust backend

### Asset Pipeline

- `assets/` is Vite's `publicDir` — files are served at root (e.g., `/pets/default/spritesheet.png` not `/assets/...`)
- Sprite format: PNG atlas + `animations.json` defining frame sequences, FPS, and transitions
- Current spritesheet: 512x64px, 8 columns, 64x64 frames
- Animations defined: `idle`, `walk_left`, `walk_right`, `fall`, `drag`

### Key Dependencies

- `tauri 2.x` (app framework), `serde` + `serde_json` (serialization)
- **Planned**: `rig-core` (AI agent), `rusqlite` (SQLite), `rdev` (input monitoring), `tray-icon` (system tray)

## Test Suite

67 tests total, all must pass:
- 11 config/animation tests in `lib.rs` (read files as strings, no Tauri runtime)
- 33 state machine transition tests in `behavior/state_machine.rs`
- 16 physics/boundary/gravity tests in `behavior/movement.rs`
- 7 cursor proximity tests in `behavior/cursor.rs`

## Implementation Harness

The project uses a long-running TDD harness driven by the `/ditto-implement` Claude Code skill. The harness manages phased implementation (5 phases, ~45 features total) with state persisted in `ditto-harness/`.

**Phases:**
1. **Skeleton** ✅ — Transparent window, sprite rendering, pet on screen
2. **Life** ✅ — State machine, movement, physics, cursor interaction, drag & drop
3. **Mind** — AI agent, chat, memory, multi-provider LLM (Ollama/OpenAI/Anthropic)
4. **Soul** — Care system, screen awareness, mood-driven behavior
5. **Polish** — System tray, settings, packaging, performance

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
- **Missing capabilities file**: No `src-tauri/capabilities/` directory yet — needed before adding more IPC commands
- **Click-through is polling-based**: 50ms interval cursor checks instead of event-driven (to be improved with `rdev` in future phase)
- **Screen edge climbing not implemented**: FSM supports climb transitions but no runtime climbing physics in frontend
- **Window size mismatch**: Tauri window is 200x200 but pet sprite is 64x64, wasting polling cycles on transparent margins

## CI

GitHub Actions runs on push/PR to `main`: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `cargo check`. All Rust commands use `--manifest-path src-tauri/Cargo.toml`.
