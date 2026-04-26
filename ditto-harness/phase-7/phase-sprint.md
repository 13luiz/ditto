# Phase 7 Sprint Contract — Interaction Foundation

> Target version: v0.2.0
> Reference: docs/PRD.md §11.2, §6 (interaction modes), §8 (bond engine), `docs/interaction-modes-spec.md`
> Estimated duration: ~3 weeks

## Goal

Ship the InteractionRouter as the central nervous system for all pet-user interaction. Light-tier modes (Bark, ThoughtBubble, SpeechBubble, RadialMenu, EmoteWheel, TouchZone, DialogPanel) render correctly on the overlay. The BondLevel engine runs end-to-end in Rust — accumulating points, persisting to SQLite, emitting level-up events — with the BondIndicator showing progress in the overlay and the ceremony animating on level-up. Interaction profiles (Minimal/Nurture/RPG) let users choose their disturbance ceiling, with mode compatibility enforced on profile switch.

## Deliverables

- New TypeScript modules:
  - `src/overlay/interaction/interaction-router.ts` — InteractionRouter class
  - `src/overlay/interaction/types.ts` — SystemOutput, InteractionEvent, InteractionMode interface, ModeCapabilities
  - `src/overlay/interaction/mode-factory.ts` — ModeFactory creating modes by type
  - `src/overlay/interaction/modes/bark-mode.ts`
  - `src/overlay/interaction/modes/thought-bubble-mode.ts`
  - `src/overlay/interaction/modes/speech-bubble-mode.ts`
  - `src/overlay/interaction/modes/radial-menu-mode.ts`
  - `src/overlay/interaction/modes/emote-wheel-mode.ts`
  - `src/overlay/interaction/modes/touch-zone-mode.ts`
  - `src/overlay/interaction/modes/dialog-panel-mode.ts`
  - `src/overlay/interaction/modes/bond-indicator-mode.ts`
  - `src/overlay/interaction/profiles.ts` — Profile presets + compatibility rules
- New Rust module: `src-tauri/src/care/bond.rs` — BondLevel engine
- Modified Rust modules:
  - `src-tauri/src/care/mod.rs` — export bond module
  - `src-tauri/src/db/migrations.rs` — new `bond_level` SQLite table
  - `src-tauri/src/commands/mod.rs` — new IPC commands for bond + interaction config
  - `src-tauri/src/behavior/state_machine.rs` — bond-level animation gating
  - `src-tauri/src/agent/prompt.rs` — bond tier guide in system prompt
- Modified frontend:
  - `src/overlay/main.ts` — replace hardcoded gestures with InteractionRouter dispatch
  - `src/overlay/setup-events.ts` — route agent/care events through router
  - `index.html` — add `#overlay-dom` div for DOM-overlay modes
  - Vue overlay micro-app mount for DOM-overlay modes
  - `src/views/SettingsView.vue` — profile selector + mode toggles + compatibility UI
- New IPC commands: `get_bond_state`, `award_bond_points`, `get_interaction_config`, `save_interaction_config`
- New SQLite table: `bond_level` (level, points, daily_points JSON, last_award_date)
- New test files for each mode and the bond engine

## Success criteria

1. InteractionRouter.handleGesture('double_click') dispatches to whichever mode the active profile maps to
2. InteractionRouter.handleOutput() routes agent text, care state, and FSM transitions to all active modes
3. Bark text appears above pet with typewriter effect, auto-fades after ~2.5s, queues at most 3 simultaneously
4. Thought icons appear for critical care needs (hunger<20, energy<20, happiness<30, social<25) and clear when need recovers above threshold
5. Speech bubble shows agent response with quick-reply chips; position flips below pet when pet is near top of screen
6. Radial menu opens on right-click with Feed/Play/Sleep/Chat segments; hovering highlights the segment; releasing dispatches the care action
7. Emote wheel opens on E key with Wave/Cheer/Scold/Dance slots; selecting an emote triggers pet animation + bark + care effect
8. Hovering over pet head/body/tail zones produces different bark reactions via TouchZoneMode hit-testing
9. Bond points accumulate from chat messages, care actions, emote exchanges; daily caps enforced per action type
10. Crossing a bond threshold (e.g., 50→Lv.2) triggers a level-up ceremony overlay with unlock notification
11. At Lv.5 the Dream Nail mode appears in Settings as "Available"; below Lv.5 it shows "Reach Lv.5 to unlock"
12. Switching profile (Minimal → Nurture → RPG) correctly mounts/unmounts modes and updates gesture mapping
13. Mutually-exclusive mode groups enforced: cannot enable SpeechBubble + DialogPanel simultaneously; cannot enable RadialMenu + EmoteWheel simultaneously
14. All Phase 6 tests (233 Rust + 5 TS suites) still pass; new tests cover InteractionRouter, each mode, and BondEngine
15. DialogPanel mode routes double-click to Pet Manager /chat (existing window) when it is the primary chat mode

## Verification methods

- Unit tests (TypeScript, vitest) — InteractionRouter protocol, BarkMode queue logic, profile compatibility rules, mode factory
- Unit tests (Rust, cargo test) — BondEngine accumulation math, threshold crossing, daily cap enforcement, SQLite persistence
- Visual tests (Playwright MCP) — Bark rendering, ThoughtBubble icons, SpeechBubble interaction, RadialMenu segment highlight, EmoteWheel selection, TouchZone hover feedback, BondIndicator display, level-up ceremony
- Integration tests (TypeScript) — profile switching mounts/unmounts modes, gesture routing dispatches to correct mode
- Integration tests (Rust) — bond points awarded from care actions → SQLite roundtrip → level-up event emission

## Out of scope (explicitly NOT this phase)

- Command Input mode (text adventure interface) — Phase 8
- Chat Log mode (MMO-style persistent log) — Phase 8
- Mini-Game mode (rock-paper-scissors, catch) — Phase 8
- Dream Nail mode (inner thoughts) — Phase 8
- Letter system — Phase 8
- Journal — Phase 8
- Live2D renderer — Phase 8
- Multi-agent / Skit system — Phase 10
- OpenClaw / ExternalAgentChannel — Phase 9
- Linux support — Phase 9

## Risks for this phase

- **Vue micro-app on transparent overlay** may conflict with existing Canvas 2D RAF loop; must verify z-index and event propagation
- **WebviewWindow budget**: overlay + Pet Manager + potential DialogPanel = 3 windows; must not exceed Tauri's practical limit
- **Contextmenu cross-platform**: right-click behavior differs on macOS; must test on both platforms (macOS deferred to physical hardware per P1-002)
- **Bond engine SQLite migration**: new table must be backwards-compatible; migration must be idempotent
- **InteractionRouter performance**: outbound bus fans out to N modes on every agent output; must keep dispatch lightweight

## Definition of "done"

The phase is done when:
1. All features in `feature-list.json` have `passes: true` and a `commit` hash
2. `cargo test` reports zero failures (233+ Rust tests)
3. `cargo clippy -- -D warnings` is clean
4. `cargo fmt --check` is clean
5. `npx tsc --noEmit` is clean
6. All vitest TypeScript test suites pass
7. Evaluator subagent issues a PASS verdict
8. User confirms phase advance
