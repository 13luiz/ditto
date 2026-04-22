# Phase 2 Evaluation Report

## Scores
- Feature completeness: 8/10
- Correctness: 8/10
- Code quality: 7/10
- PRD alignment: 7/10

## Overall verdict: PASS

All criteria score at or above 7/10. The phase delivers working state machine, physics, cursor interaction, drag-and-drop, and multi-monitor support with solid test coverage (67 tests, zero failures). Issues below are real but do not block the phase gate.

---

## Issues found

### 1. Severity: minor -- `cargo fmt` not applied

- **Description:** `cargo fmt --check` reports formatting differences in `behavior/cursor.rs`, `behavior/mod.rs`, `behavior/movement.rs`, and `behavior/state_machine.rs`. Long function signatures and assertion macros exceed the default line width.
- **Location:** `src-tauri/src/behavior/cursor.rs` (lines 6, 17), `src-tauri/src/behavior/mod.rs` (line 1-3), `src-tauri/src/behavior/movement.rs` (lines 120, 255), `src-tauri/src/behavior/state_machine.rs` (multiple test lines)
- **Suggested fix:** Run `cargo fmt --manifest-path src-tauri/Cargo.toml` and commit the result. The CI pipeline (`cargo fmt --check`) will fail on the current code.

### 2. Severity: major -- PRD Phase 2 features missing from feature-list.json

- **Description:** The PRD Phase 2 table lists 9 tasks. Two are absent from the feature-list.json entirely:
  1. **Random wandering** -- The PRD says "Pet autonomously wanders when idle." The frontend `PetController.startWandering()` does implement basic wandering (30% chance walk_left, 30% walk_right every 5s), but there is no dedicated feature entry in feature-list.json for it. It is partially covered by P2-005 but has no explicit test or verification.
  2. **Screen edge climbing** -- The PRD says "Pet can climb left/right screen edges." The state machine supports `walk_* -> climb` and `climb -> fall` transitions, but there is no climbing physics implementation in the frontend `PetController`. When the pet reaches a screen edge it just stops and goes idle. No climbing animation or vertical movement up the edge is implemented. P2-001 tests the FSM transitions for climb, but the actual climbing behavior is not built.
- **Location:** `src/behavior/pet-controller.ts` lines 118-131 (walking stops at edge with `setState('idle')`, no climb logic); `ditto-harness/phase-2/feature-list.json` (no P2 entry for wandering or climbing behavior)
- **Suggested fix:** Either add feature entries for these in a follow-up phase, or acknowledge them as deferred with a known-issue note. The climb state in the FSM is correct structurally -- only the runtime behavior is missing.

### 3. Severity: minor -- `#[allow(dead_code)]` on all public API surfaces

- **Description:** Every struct, impl block, and public function in the behavior module is annotated with `#[allow(dead_code)]`. This is fine during development, but it suppresses the compiler's natural dead-code detection. Some items (e.g., `cursor_distance`, `Velocity::zero`, `Position::zero`) genuinely appear unused.
- **Location:** `src-tauri/src/behavior/state_machine.rs`, `src-tauri/src/behavior/movement.rs`, `src-tauri/src/behavior/cursor.rs`
- **Suggested fix:** Remove blanket `#[allow(dead_code)]` and apply it only where genuinely needed (items reserved for future phases). Let the compiler flag truly dead code.

### 4. Severity: minor -- Frontend state machine is not synchronized with backend

- **Description:** The Rust backend has a full `StateMachine` with context-aware transitions (energy checks, mood checks, cursor distance). The frontend `PetController.setState()` sets any state directly with no validation. The backend FSM is well-tested but never actually drives pet behavior at runtime -- the frontend makes all state decisions unilaterally. This means the backend FSM is currently library code with no integration point.
- **Location:** `src/behavior/pet-controller.ts` `setState()` method (line 64-99); no IPC call to backend for state transitions
- **Suggested fix:** Acceptable for Phase 2 since the FSM is validated by tests and will be integrated when the agent (Phase 3) drives behavior through IPC. Document this as an intentional Phase 2 simplification.

### 5. Severity: minor -- Animation definitions incomplete for Phase 2 states

- **Description:** The `animations.json` defines animations for `idle`, `walk_right`, `walk_left`, `fall`, and `drag` (5 states). The PRD Section 5.2 defines 16 states, and the FSM supports all 16. Missing animation definitions for: `run_left`, `run_right`, `climb`, `sleep`, `eat`, `play`, `talk`, `happy`, `sad`, `curious`, `sit`. The `AnimationPlayer.play()` will call `getAnimation()` which returns `undefined` for missing states, and `update()` returns frame 0 -- the pet will render the first spritesheet frame as a fallback.
- **Location:** `assets/pets/default/animations.json`; `src/renderer/animation.ts` line 43 (silent fallback to frame 0)
- **Suggested fix:** Add placeholder animation definitions for all 16 states. Even reusing existing frames (e.g., `run_right` using `walk_right` frames at higher FPS) would be more correct than the silent fallback. This is not blocking because the spritesheet itself may not have distinct art for every state.

### 6. Severity: minor -- Multi-monitor detection uses heuristics

- **Description:** P2-007 (multi-monitor crossing) uses `window.screen.availWidth` vs `window.screen.width` to detect multi-monitor setups. This is a browser heuristic, not a reliable API. The Tauri window is only 200x200px, so crossing monitors means moving the window position beyond the primary screen coordinates. The implementation allows the pet to walk to negative X (off-screen left) or beyond `screenWidth` (right), which relies on the OS window manager placing the window on the adjacent monitor.
- **Location:** `src/behavior/pet-controller.ts` lines 44-50, 122-129
- **Suggested fix:** Acceptable for Phase 2. For production, use Tauri's `availableMonitors()` API to get exact monitor geometries.

### 7. Severity: minor -- DragHandler does not re-enable click-through after release

- **Description:** When dragging starts, `DragHandler.onMouseDown()` calls `set_ignore_cursor_events(false)` to enable pointer events. After `onMouseUp()`, the pet transitions to `fall` state, but `set_ignore_cursor_events(true)` is never explicitly called. The `ClickThroughHandler` polling loop will eventually re-enable it on the next 50ms cycle, but there is a brief window where the window captures all mouse events.
- **Location:** `src/input/drag-handler.ts` lines 38-39, 52-56
- **Suggested fix:** The 50ms polling interval makes this practically harmless, but for cleanliness, call `set_ignore_cursor_events(true)` in `onMouseUp()`.

### 8. Severity: minor -- Window size hardcoded at 200x200 in config

- **Description:** The Tauri window is configured as 200x200 but the pet sprite is 64x64. The extra space (136px) is transparent canvas. This means the pet has a 68px invisible margin on each side where clicks are captured but no sprite is drawn. The `ClickThroughHandler` correctly handles this by checking pixel alpha, but it wastes polling cycles checking transparent areas.
- **Location:** `src-tauri/tauri.conf.json` line 21 (width/height 200)
- **Suggested fix:** Either set the window size to 64x64 (matching the sprite), or dynamically resize the window after loading the animation config. This is a carry-over from Phase 1, not a Phase 2 regression.

---

## Recommendations

1. **Run `cargo fmt` before committing.** The CI `cargo fmt --check` gate will reject the current formatting. This is a one-command fix.

2. **Consider adding a feature-list entry for "random wandering"** even though the implementation exists. The harness tracks features by ID, and having no explicit entry means no formal verification was recorded.

3. **The backend FSM is well-designed but currently unused at runtime.** Phase 3's agent integration should be the point where the Rust state machine becomes the authority. Document this decision so the next phase knows to wire it up.

4. **The `PetController.update()` guards against `dt > 0.1`** (line 108), which means if the browser tab is backgrounded for more than 100ms, the pet freezes instead of catching up. This is a reasonable choice for a desktop pet, but worth noting.

5. **Test coverage is strong at 67 tests**, with good coverage of edge cases (exact boundary values for cursor distance, gravity landing detection, invalid state transitions). The test naming is descriptive and the test structure follows a clear pattern.

6. **The `apply_gravity` function in `movement.rs`** has a subtle logic detail: `was_falling` is true if `vy > 0` OR `y < ground`. This means if the pet is pushed upward (negative vy) while on the ground, it won't report a "landing" when it returns. This is correct behavior -- you can't "land" if you never left -- but worth documenting in a comment.

7. **Phase 1 tests are still passing** (11 config/animation tests), confirming no regressions from Phase 2 changes. This is good hygiene.
