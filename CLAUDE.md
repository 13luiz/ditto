# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ditto is an agent-driven desktop pet built with **Rust + Tauri v2**. An animated creature lives on a transparent overlay window, with behavior governed by an AI agent (rig-core) rather than scripts. Phase 1 (Skeleton) is complete. The app renders a sprite on a transparent frameless window with per-pixel click-through detection.

## Build & Development Commands

```bash
# Install frontend dependencies
npm install

# Run in dev mode (starts Vite + Rust backend)
npx tauri dev

# Run all Rust tests
cargo test --manifest-path src-tauri/Cargo.toml

# Run a single test
cargo test --manifest-path src-tauri/Cargo.toml <test_name>

# Format check
cargo fmt --manifest-path src-tauri/Cargo.toml --check

# Auto-format
cargo fmt --manifest-path src-tauri/Cargo.toml

# Lint (must pass with zero warnings)
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

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
- `lib.rs` — Tauri builder with command registration + all unit tests (11 tests, gated behind `#[cfg(test)]`)
- `commands/mod.rs` — IPC commands: `set_ignore_cursor_events`, `get_cursor_position`
- **Planned modules** (not yet created): `agent/`, `behavior/`, `care/`, `system/`, `db/`

The commands module is gated with `#[cfg(not(test))]` because Tauri runtime dependencies (WebView2) crash the test harness. Tests verify command registration by reading source files as strings.

### Frontend (TypeScript, `src/`)

- `main.ts` — Bootstraps SpriteEngine and ClickThroughHandler
- `renderer/sprite-engine.ts` — Canvas 2D sprite loader and requestAnimationFrame render loop
- `renderer/animation.ts` — `AnimationPlayer` class with FPS-controlled frame sequencing, looping, transitions
- `input/click-through.ts` — Polls cursor position every 50ms, checks pixel alpha, toggles `set_ignore_cursor_events`

### Asset Pipeline

- `assets/` is Vite's `publicDir` — files are served at root (e.g., `/pets/default/spritesheet.png` not `/assets/...`)
- Sprite format: PNG atlas + `animations.json` defining frame sequences, FPS, and transitions
- Current spritesheet: 512x64px, 8 columns, 64x64 frames

### Key Dependencies

- `tauri 2.x` (app framework), `serde` + `serde_json` (serialization)
- **Planned**: `rig-core` (AI agent), `rusqlite` (SQLite), `rdev` (input monitoring), `tray-icon` (system tray)

## Implementation Harness

The project uses a long-running TDD harness driven by the `/ditto-implement` Claude Code skill. The harness manages phased implementation (5 phases, ~45 features total) with state persisted in `ditto-harness/`.

**Phases:**
1. **Skeleton** ✅ — Transparent window, sprite rendering, pet on screen
2. **Life** — Movement, physics, cursor interaction, drag & drop
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
- `.claude/commands/ditto-implement.md` — The harness skill (session-based TDD driver)

## Known Issues

- **P1-002 deferred**: macOS transparent window verification requires physical hardware
- **Missing capabilities file**: No `src-tauri/capabilities/` directory yet — needed before adding more IPC commands
- **Click-through is polling-based**: 50ms interval cursor checks instead of event-driven (to be improved with `rdev` in Phase 2)

## CI

GitHub Actions runs on push/PR to `main`: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `cargo check`. All Rust commands use `--manifest-path src-tauri/Cargo.toml`.
