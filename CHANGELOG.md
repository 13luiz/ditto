# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-04-27

### Added

- **Phase 8 — Depth & Cozy Loop**: Live2D renderer, mini-games, letters, journal, dream nail, chat log, command input, 13 new IPC commands
- `Live2DRenderer` TypeScript class with WebGL transparency, `PetRenderer` + `LipSyncable` + `Expressible` support via `pixi-live2d-display`
- `MiniGame` Rust module — Rock-Paper-Scissors and Catch-the-Food logic with care effects (happiness/hunger/energy)
- `generation.rs` — Agent generation extensions: inner thought, letter writing, journal entry prompts with rule-based fallbacks
- `db/models.rs` — DB models for letters, journal entries, mini-game results
- `DreamNailMode` — Peek into pet's inner thoughts with bond gating (Lv.3+) and daily use rate limiting
- `LetterMode` — Send/receive letters with pet, bond gating (Lv.2+), envelope notification, reply archive
- `JournalMode` — Pet-generated journal entries with calendar view, bond gating (Lv.4+), date-range queries
- `ChatLogMode` — Overlay shows recent 3 chat log entries with auto-fade, multi-tab log viewer in Pet Manager
- `CommandInputMode` — Slash command input with `/think`, `/letter`, `/journal` parsing and autocomplete
- `MiniGameMode` — Overlay interaction mode for RPS + Catch-the-Food games with care effect dispatch
- `LettersView`, `JournalView`, `ChatLogView` — Pet Manager tabs for letter archive, journal calendar, chat history
- Play tab refactored to game history view with `get_game_history` IPC
- ChatLog 6-tab architecture: Chat (built), Memory, Identity (built), Letters, Journal, Play (deferred tabs for future)
- Live2D sample skin packaging with `skin.json` manifest and performance profiling
- `generate_inner_thought` IPC wired to agent pipeline with SQLite daily use persistence
- `generate_journal_entry` IPC wired to agent pipeline with memory integration
- 13 new IPC commands: `get_pending_letters`, `mark_letter_read`, `send_letter_reply`, `get_letter_archive`, `get_journal_entries`, `generate_journal_entry`, `start_mini_game`, `submit_mini_game_result`, `get_game_history`, `generate_inner_thought`, `get_dream_nail_uses`, `list_memories`, `get_personality`
- 315 Rust tests (62 new), ~312 TypeScript tests (159 new across Live2D, mini-game, dream-nail, letter, journal, chat-log, command-input modes)

### Changed

- 34 IPC commands registered (up from 21)
- Bond-level gating enforced across dream nail, letter, and journal modes
- InteractionRouter now supports 14 modes (up from 8)
- `db/migrations.rs` adds `letters`, `letter_replies`, `journal_entries`, `mini_game_results` tables

## [0.1.2] - 2026-04-26

### Added

- **Phase 7 — Interaction Foundation**: InteractionRouter, 7 interaction modes, bond engine, interaction profiles
- `InteractionRouter` TypeScript class with mode registry, outbound bus, inbound bus, gesture dispatch, and mode lifecycle management
- `InteractionMode` interface with capabilities reporting, rendering surface, and tier classification
- `SystemOutput` and `InteractionEvent` discriminated union types for router→mode and mode→router communication
- `#overlay-dom` div in `index.html` for DOM-overlay interaction modes, separate from Canvas 2D RAF loop
- `BarkMode` — DOM overlay bark bubbles above pet: typewriter effect, auto-fade (2.5s hold + 0.5s fade), queue cap 3
- `ThoughtBubbleMode` — Emoji icons for critical care needs (🍖 hunger, 😢 happiness, 💤 energy, 💬 social), red border pulse
- `SpeechBubbleMode` — Comic-style DOM bubble with streaming text, quick-reply chips, position-flip near screen top
- `RadialMenuMode` — SVG ring with 4 segments (Feed/Play/Sleep/Chat), hover highlight, care action dispatch, Escape/outside-click dismiss
- `EmoteWheelMode` — Grid wheel with 4 emotes (Wave/Cheer/Scold/Dance), emote-to-FSM-state mapping, emote-to-bark mapping
- `TouchZoneMode` — Zone-based touch detection from skin.json rects, 500ms hover highlight, click dispatches touch events
- `DialogPanelMode` — Integrates Pet Manager /chat route with InteractionRouter gesture dispatch
- `BondIndicatorMode` — Lv.N + heart progress bar near pet, level-up ceremony overlay (sparkles + BOND UP text)
- `InteractionProfileManager` — Minimal/Nurture/RPG profile presets with mode enable/disable and gesture mapping
- `BondEngine` Rust module — 10-level threshold table, daily caps per action type, SQLite persistence
- `get_bond_state` / `award_bond_points` IPC commands for bond state query and point awarding
- `bond_level_up` Tauri event emission on level-up
- Bond-level animation gating in FSM (`resolve_animation_variant`)
- Bond tier guide in system prompt (formal→casual→warm→trusting→authentic at levels 1-10)
- Gesture dispatch refactor in `main.ts` — hardcoded dblclick/contextmenu replaced with `router.handleGesture()` with fallback
- `MUTUALLY_EXCLUSIVE_GROUPS` and `ALWAYS_CONCURRENT` compatibility enforcement
- 253 Rust tests (13 new bond engine tests), 153 TypeScript tests (113 new interaction mode tests)

### Changed

- `transition_pet_state` IPC now reads actual bond_level from database instead of hardcoding 1
- `setup-events.ts` accepts optional InteractionRouter to route agent text through `handleOutput()`
- `care/mod.rs` exports `BondAction` and `BondEngine` without `#[allow(unused_imports)]`
- 21 IPC commands registered (up from 19)

## [0.1.1] - 2026-04-26

### Added

- **Phase 6 — Skin Foundation**: Multi-renderer architecture, skin distribution system, unified Pet Manager UI
- `PetRenderer` TypeScript interface with capability reporting and type guards (`LipSyncable`, `Expressible`, `ParameterDrivable`)
- `SpriteRenderer` wrapping existing `SpriteEngine` logic as a `PetRenderer` implementation
- `SpineRenderer` using `@esotericsoftware/spine-canvas` for skeletal animation support
- `RendererFactory` dispatching correct renderer from skin manifest (`sprite`, `spine`, with extensible types)
- `SkinManifest` TypeScript type and validation matching visual-rendering-spec v1.0 schema
- `system/skins.rs` replacing `system/themes.rs` — full skin discovery, import, and management in Rust
- Skin catalog merging bundled skins (`public/skins/`) and user-installed skins (`$APPDATA/Ditto/skins/`) with deduplication
- `import_skin_zip` IPC with manifest validation and path-traversal security protection
- `import_skin_url` IPC for downloading and installing skins from URL
- `delete_skin` IPC with bundled-skin deletion protection via path canonicalization
- `get_active_skin` / `set_active_skin` IPC persisting selection in settings DB
- Unified Pet Manager window replacing standalone chat-bubble, care-panel, and settings windows
- `/skins` route in Pet Manager with grid gallery, renderer-type filter tabs, and active-skin selection
- Sample Spine skin (`public/skins/sample-spine/`) with 8 animations and valid skeleton, atlas, texture
- Default skin manifest (`public/skins/default/`) for catalog visibility
- `AgentBackend` trait scaffold in Rust for forward-compat external agent support (Phase 9)
- Vitest + jsdom test infrastructure for TypeScript unit tests
- 233 Rust tests (11 new in skins.rs), 40+ TypeScript tests across 5 test suites

### Changed

- Renamed `system/themes.rs` → `system/skins.rs`, `list_themes` IPC → `list_skins`
- Unified Pet Manager window with tabbed layout (Chat/Care/Skins/Settings) via Vue Router
- Tray menu "Settings" replaced with "Pet Manager" opening unified window
- Old standalone window launchers (`chat-bubble.ts`, `care-panel.ts`, `settings.ts`) now delegate to `openPetManager()`

## [0.1.0] - 2026-04-26

### Changed

- Renamed `src/pet/` to `src/overlay/` — clearer name for the transparent overlay window app
- Renamed `assets/` to `public/` — follows Vite's default `publicDir` convention
- Consolidated `PetState` type to single definition in `src/types/pet-state.ts` (was duplicated in pet-controller.ts and PetRenderer.ts)
- Extracted event setup from `overlay/main.ts` into `overlay/setup-events.ts` (setupPetActions, setupSettingsListener, setupActivityTracking, setupScheduler)
- Replaced 9 empty `catch {}` blocks with dev-mode logging via `import.meta.env.DEV`
- Deleted unused `src/pet/renderers/` directory (7 files: PetRenderer interface, RendererFactory, SpriteRenderer, SpineRenderer, Live2DRenderer, LottieRenderer, VRMRenderer — none were imported)
- Deleted dead `src/types/renderer.ts` barrel file (nothing imported from it)

## [0.0.6] - 2026-04-25

### Added

- **Phase 5 — Polish**: System tray, settings, packaging, performance
- System tray icon with show/hide, settings, and quit menu
- Settings UI panel with LLM config, pet name, and behavior preferences
- Settings persistence with roundtrip save/load to SQLite
- Auto-launch registration via settings toggle
- Custom pet theme loading with theme discovery from data directory
- First-run onboarding wizard for pet name and LLM setup
- Bundler config for MSI, NSIS, and DMG installers with auto-update capability
- LLM error recovery with provider fallback chain (try primary → fallbacks → rule-based)
- Behavior scheduler wired to runtime with check_and_fire triggers for greetings and idle comments
- Care system decay wired to runtime via load_with_decay (applies elapsed time on startup)
- Offline rule-based coverage expanded with more response categories (time greetings, emotions, questions, compliments)
- Database corruption recovery — auto-recreates DB if migration fails
- Performance measurement script for profiling
- `rstest` dev-dependency for parameterized tests
- Spec documents for interaction modes and visual rendering

### Changed

- Refactored movement and state machine tests to use `rstest` parameterized cases (reduced duplication)
- Consolidated agent tests into dedicated `tests/` subdirectory with integration, tool, and error recovery modules
- Expanded rule-based responses with deterministic variety via input hashing for default fallbacks

## [0.0.5] - 2026-04-24

### Added

- **Phase 4 — Soul**: Pet has needs, awareness, and mood-driven behavior
- Care system with four needs (hunger, happiness, energy, social) and PRD-aligned decay rates
- Mood engine with weighted scoring (hunger×0.3 + happiness×0.3 + energy×0.2 + social×0.2)
- Five mood bands: Ecstatic (≥80), Happy (≥60), Neutral (≥40), Sad (≥20), Miserable (<20)
- Care panel as separate WebviewWindow (care.html + care-window.ts) with dark theme UI
- Procedural sound effects via Web Audio API (happy, sad, hungry, pet, feed, sleep, chat, greeting)
- Behavior scheduler with morning greeting, break reminder, and idle comment triggers
- Activity detector with idle/work state tracking
- Screen capture module using `xcap` crate for screen awareness
- LLM provider tool for screen context (`CaptureScreen`)
- Real LLM streaming via rig-core `StreamingPrompt` + tokio mpsc channel
- `get_care_state` and `apply_care_action` IPC commands

### Fixed

- Care panel opens as independent window instead of injecting into pet's 64×64 window
- Window close uses `destroy()` instead of `close()` for chat and care panels (fully removes window)
- Added Tauri capabilities for care window and destroy permission
- LLM errors now surfaced visibly in chat (`[LLM error: ...]` prefix) instead of silent fallback
- Set `default_max_turns` to 25 for long-running autonomous agent behavior
- Pet drag positioning preserved with `userPlaced` flag — pet stays where dropped, doesn't snap to ground
- Transparent window border fixed: `backgroundColor: #00000000`, `shadow: false`, explicit transparent CSS on all elements
- Added `futures` dependency for `StreamExt` in streaming implementation

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

[0.1.2]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.1.2
[0.1.1]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.1.1
[0.1.0]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.1.0
[0.0.6]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.6
[0.0.5]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.5
[0.0.4]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.4
[0.0.3]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.3
[0.0.2]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.2
[0.0.1]: https://github.com/luiz-tb16p/ditto/releases/tag/v0.0.1
