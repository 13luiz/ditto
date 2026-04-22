# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.0.3]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.3
[0.0.2]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.2
[0.0.1]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.1
