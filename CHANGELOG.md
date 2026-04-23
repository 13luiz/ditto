# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.4] - 2026-04-23

### Added

- **Phase 3 — Mind**: Pet can think, converse, and remember
- SQLite database with migrations for conversations, messages, memory, and settings
- LLM provider abstraction supporting OpenAI, Anthropic, and Ollama via rig-core
- System prompt builder with personality traits, mood, needs, and time context
- Agent tool definitions (move_to, change_state, speak, remember, recall, show_emotion)
- Chat UI in a second Tauri window (chat.html + chat-window.ts) with streaming token display
- Conversation persistence — messages saved to SQLite, reloadable after restart
- Memory system with short-term (sliding window) and long-term (key-value) recall
- Personality trait engine with shift mechanics over time
- Rate limiting for proactive LLM calls (30-second minimum interval)
- Rule-based fallback when no LLM provider is configured
- LLM provider config via `.env` file (`DITTO_LLM_API_KEY`, `DITTO_LLM_TYPE`, `DITTO_LLM_MODEL`, `DITTO_LLM_BASE_URL`)
- `send_chat_message` and `load_chat_history` IPC commands wired to agent + DB
- 71 new Rust tests (138 total): agent core, tools, memory, personality, prompt, DB persistence

### Fixed

- Multi-monitor DPI coordinate system — all position calculations use PhysicalPosition + scaleFactor
- Click-through alpha detection uses correct physical-to-canvas coordinate conversion
- Drag handler uses `get_cursor_position` IPC for cross-monitor coordinate consistency
- Ground level detection uses monitor workArea (physical pixels) instead of CSS pixels
- DB moved to `%LOCALAPPDATA%/ditto/` to prevent dev watcher restart loops
- Async chat command properly drops DB Mutex lock before `.await` (no more `block_on` panics)
- Chat window positioned above pet using physical-to-logical coordinate conversion
- Chat window uses JS `WebviewWindow` API to avoid WebView2 builder crash on Windows

## [0.0.3] - 2026-04-23

### Changed

- Window size reduced from 200×200 to 64×64 to match sprite dimensions, reducing unnecessary click-through polling
- Replaced 20+ per-item `#[allow(dead_code)]` annotations with a single module-level annotation on the behavior module
- Updated README to reflect current project status and architecture

### Fixed

- DragHandler now properly re-enables click-through on mouse release
- Added missing DPI coordinate space assumption comment in click-through handler

### Added

- Tauri v2 capabilities file (`src-tauri/capabilities/default.json`) with explicit IPC permissions for current and planned commands
- Complete animation definitions for all 16 PetStates (previously only 5/16 were defined)
- Phase 2 evaluation report

## [0.0.2] - 2026-04-22

### Added

- **Phase 2 — Life**: Pet can move, interact, and respond to input
- 16-state finite state machine (FSM) with context-aware transitions for energy, mood, cursor distance, and idle time
- Screen boundary collision detection with position clamping
- Gravity simulation at 980 px/s² with ground detection and landing events
- Cursor proximity detection using Euclidean distance (100px radius threshold)
- Autonomous wandering behavior — pet walks left/right at random intervals
- Grab and drag with per-pixel click detection and gravity-based release
- Multi-monitor support with total display width detection
- `set_window_position` IPC command for window movement
- `PetController` frontend class managing state, velocity, position, and window IPC
- `DragHandler` frontend class for mouse-based pet dragging
- Walk and drag animation definitions in `animations.json`
- 56 new Rust tests (67 total): 33 state machine, 16 physics/boundary/gravity, 7 cursor proximity

## [0.0.1] - 2026-04-22

### Added

- Product Requirements Document ([PRD](docs/PRD.md))
- Long-running TDD implementation harness skill (`/ditto-implement`)
- Harness design spec and implementation plan
- Project scaffolding (README, LICENSE, CHANGELOG, CONTRIBUTING)
- GitHub issue templates (bug report, feature request)
- GitHub pull request template
- CI workflow (Rust checks: fmt, clippy, test)
- `.gitignore` for `.repos/` and `.claude/`

[0.0.4]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.4
[0.0.3]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.3
[0.0.2]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.2
[0.0.1]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.1
