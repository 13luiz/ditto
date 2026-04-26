# Phase 8 Sprint Contract — Depth & Cozy Loop

> Target version: v0.3.0
> Reference: docs/PRD.md §11.3, §5 (Live2D), §6 (Active/Review modes), §7.5 (cozy↔agent), §8 (bond engine)
> Estimated duration: 6 weeks

## Goal

Phase 8 adds depth to the pet's inner life and gives the user new ways to engage. Two major workstreams: (1) a Live2D renderer using PixiJS v6 + pixi-live2d-display, validated via PoC on day 1; (2) Active-tier modes (CommandInput, ChatLog, Mini-Game), Review-tier modes (DreamNail, Letter, Journal), and their backend pipelines (new SQLite tables, IPC commands, agent generation prompts). Letters and journal entries feed back into long-term memory so the agent can reference its own past inner life. Bond-level gating ensures cozy features unlock progressively.

## Deliverables

- Code modules created:
  - `src/overlay/renderer/live2d-renderer.ts` — Live2DRenderer implementing PetRenderer
  - `src/overlay/interaction/modes/command-input-mode.ts` — CommandInputMode
  - `src/overlay/interaction/modes/chat-log-mode.ts` — ChatLogMode
  - `src/overlay/interaction/modes/mini-game-mode.ts` — MiniGameMode
  - `src/overlay/interaction/modes/dream-nail-mode.ts` — DreamNailMode
  - `src/overlay/interaction/modes/letter-mode.ts` — LetterMode
  - `src/overlay/interaction/modes/journal-mode.ts` — JournalMode
  - `src-tauri/src/care/minigame.rs` — Mini-game backend logic
  - `src/views/LettersView.vue` — Pet Manager /letters route
  - `src/views/JournalView.vue` — Pet Manager /journal route
  - `src/views/ChatLogView.vue` — Pet Manager /chat-log route
- Refactored modules:
  - `src-tauri/src/db/migrations.rs` — new tables: letters, journal_entries, mini_game_results
  - `src-tauri/src/db/mod.rs` — CRUD for letters, journal, mini-game results
  - `src-tauri/src/agent/core.rs` — `generate_inner_thought` for Dream Nail
  - `src-tauri/src/agent/prompt.rs` — dream nail prompt, letter prompt, journal prompt
  - `src-tauri/src/commands/mod.rs` — new IPC commands
  - `src/router/index.ts` — new routes: /letters, /journal, /chat-log
  - `src/ipc/commands.ts` — new IPC wrappers
  - `src/overlay/interaction/types.ts` — new SystemOutput/InteractionEvent variants
  - `src/overlay/interaction/profile-manager.ts` — new mode registrations
- New IPC commands: `get_pending_letters`, `mark_letter_read`, `send_letter_reply`, `get_letter_archive`, `get_journal_entries`, `generate_journal_entry`, `start_mini_game`, `submit_mini_game_result`, `generate_inner_thought`
- New SQLite tables: `letters`, `journal_entries`, `mini_game_results`
- New dependencies: `pixi.js@^6`, `pixi-live2d-display@^0.4` (bundled Cubism 4 Core)
- Sample assets: `public/skins/sample-live2d/` (minimal Live2D model for testing)

## Success criteria

1. Live2D PoC: transparent WebGL canvas renders a Live2D model on the Tauri overlay window on Windows without flicker, background artifacts, or z-order issues
2. Live2DRenderer implements PetRenderer protocol: load, setState, hitTest, update, getCanvas, capabilities, destroy
3. Live2DRenderer exposes LipSyncable capability via ParamMouthOpenY; mouth opens proportionally to text length during agent streaming
4. Live2DRenderer exposes Expressible capability; PetState maps to Live2D motion groups via skin manifest state_map
5. Live2D sample skin loads via existing skin import (zip); appears in Pet Manager /skins catalog with correct metadata
6. CommandInputMode: terminal-style inline input appears near pet, parses care/chat/movement/info commands, routes to appropriate IPC, shows inline response
7. CommandInputMode: autocomplete dropdown shows matching commands as user types
8. ChatLogMode: Pet Manager /chat-log route renders multi-tab (Chat/System/Memory/All) persistent log with timestamp, color-coded entries, and bottom input
9. ChatLogMode: entries persist across sessions via SQLite-backed message/event/care-state log
10. MiniGameMode: Rock-Paper-Scissors game — 5 rounds, click to choose, pet responds, score tracked, Happiness awarded via care system
11. MiniGameMode: Catch-the-Food game — 30s timer, arrow key controls, falling food items, score→Hunger bonus
12. MiniGameMode results persisted in mini_game_results table with care_effects_json
13. DreamNailMode: Alt+hover on pet triggers inner thought generation; translucent dream overlay with italic text; rate-limited to 3/day; bond-gated at Lv.5+
14. LetterMode: offline >4h + bond Lv.6+ generates letter on launch; envelope notification bark; letter reading/reply in Pet Manager /letters
15. Letter pipeline: agent receives LetterContext, generates 100-200 word content, stores in letters table, letter content fed back into long-term memory
16. JournalMode: end-of-day trigger generates diary entry; Pet Manager /journal shows calendar view with mood emoji; bond-gated at Lv.7+
17. Journal pipeline: agent receives JournalContext (conversations, care, mood timeline), generates 3-5 bullet first-person entry, stored in journal_entries table, content fed into long-term memory
18. Bond-level gating enforced: DreamNail Lv.5+, Letter Lv.6+, Journal Lv.7+, MiniGame Lv.7+ — modes refuse activation below threshold with user-visible message
19. Profile manager updated: Nurture profile includes Letter+Journal+MiniGame; RPG profile includes all modes including CommandInput and ChatLog
20. Performance: 4 simultaneous DOM modes + 1 Live2D renderer stays under PRD §12 CPU/RAM budget (Live2D idle < 110MB, CPU < 8%)

## Verification methods

- Unit tests in `src-tauri/src/{module}/mod.rs` — for pure Rust logic (letter/journal generation scheduling, mini-game scoring, dream nail rate limiting, bond gating)
- Integration tests in `src-tauri/src/agent/tests/` — for letter/journal pipeline with DB roundtrip
- Unit tests in `src/overlay/interaction/modes/__tests__/` — for mode rendering logic, command parsing, event dispatch
- Unit tests in `src/overlay/renderer/__tests__/live2d-renderer.test.ts` — for Live2DRenderer protocol compliance
- Visual tests via Playwright MCP — for Live2D transparency, mini-game UI, command input, Pet Manager routes
- Manual verification — for Live2D model quality, dream nail subjective tone, letter/journal content quality
- Profiling — for Live2D RAM/CPU against PRD §12 budget

## Out of scope (explicitly NOT this phase)

- Live2D lip-sync from actual TTS audio (requires rodio integration) — Phase 8 uses text-length heuristic only
- Memory Match and Simon Says mini-games — only Rock-Paper-Scissors and Catch-the-Food ship in Phase 8
- Skit system — deferred to Phase 10 (Multi-Agent)
- OpenClaw/ExternalAgentChannel — deferred to Phase 9
- macOS-specific NSWindow transparency — deferred until macOS hardware available; Windows PoC sufficient for Phase 8
- VRM, Lottie renderers — post-v0.6.0
- Live2D model authoring tools or skin editor — not in scope

## Risks for this phase

- **Live2D WebGL transparency PoC must pass first.** If Tauri's WebView2 on Windows can't do transparent WebGL, the entire Live2D renderer is blocked. P8-001 is the gate — fail fast.
- **PixiJS v6 version lock.** `pixi-live2d-display@0.4` only works with PixiJS v6. Future conflicts with other deps possible. Pin strictly.
- **`live2dcubismcore.min.js` bundling.** The Cubism 4 Core WASM/binary must be in `public/` for runtime loading. License allows runtime redistribution for Indie tier.
- **Agent generation quality.** Letters, journal entries, and inner thoughts depend on LLM quality. Rule-based fallback templates needed for offline/error scenarios.
- **IPC command surface expansion.** 9 new commands is substantial. Each needs the `#[cfg(not(test))]` gating per CLAUDE.md.

## Definition of "done"

The phase is done when:
1. All features in `feature-list.json` have `passes: true` and a `commit` hash
2. `cargo test` reports zero failures
3. `cargo clippy -- -D warnings` is clean
4. `cargo fmt --check` is clean
5. `npx tsc --noEmit` is clean
6. Evaluator subagent issues a PASS verdict
7. User confirms phase advance
