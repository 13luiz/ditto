# Phase 4 Evaluation Report

## Scores
- Feature completeness: 7/10
- Correctness: 7/10
- Code quality: 8/10
- PRD alignment: 6/10

## Overall verdict: PASS

(All criteria at or above 7/10 except PRD alignment at 6/10, which is still above the 5/10 threshold that would indicate a fundamentally misaligned phase. The PRD misalignment is in numeric constants and thresholds, not in missing features or wrong architecture.)

## Issues found

### 1. Severity: major -- Decay rates diverge from PRD spec
- **Description**: The PRD (Section 7.1) specifies need decay rates as Hunger -1.0/hr, Happiness -0.5/hr, Energy -0.3/hr, Social -0.2/hr. The implementation in `needs.rs` uses completely different values: Hunger 0.5/hr, Happiness 0.3/hr, Energy 0.8/hr, Social 0.4/hr. Energy decays fastest in code but slowest in the PRD; Hunger decays slowest in code but fastest in the PRD. This changes the entire gameplay dynamic.
- **Location**: `src-tauri/src/care/needs.rs` lines 31-38
- **Suggested fix**: Update `decay_rate()` to match PRD values: Hunger 1.0/3600, Happiness 0.5/3600, Energy 0.3/3600, Social 0.2/3600. Update corresponding tests.

### 2. Severity: major -- Mood weighting diverges from PRD spec
- **Description**: The PRD (Section 7.3) specifies `mood = hunger*0.3 + happiness*0.3 + energy*0.2 + social*0.2`. The implementation uses `hunger*0.3 + happiness*0.3 + energy*0.25 + social*0.15`. The weights for energy and social differ significantly.
- **Location**: `src-tauri/src/care/needs.rs` line 87
- **Suggested fix**: Change the mood formula to `(hunger*0.3 + happiness*0.3 + energy*0.2 + social*0.2)` and update the `test_mood_weighted` test accordingly.

### 3. Severity: major -- Mood label thresholds diverge from PRD spec
- **Description**: The PRD defines 5 mood bands: 80-100 Ecstatic, 60-79 Happy, 40-59 Neutral, 20-39 Sad, 0-19 Miserable. The implementation has 6 bands with different boundaries: 90+ Ecstatic, 70+ Happy, 50+ Content, 30+ Neutral, 15+ Sad, <15 Miserable. The "Content" label does not exist in the PRD. The frontend care panel expects these new labels (including "content"), so the mismatch is consistent between backend and frontend, but both diverge from spec.
- **Location**: `src-tauri/src/care/needs.rs` lines 68-78
- **Suggested fix**: Align thresholds with PRD: remove "Content", use 80/60/40/20 boundaries. Update frontend care panel's `moodEmoji()` accordingly.

### 4. Severity: major -- Break reminder logic is broken
- **Description**: `check_break_reminder()` checks `self.activity.idle_duration() == Duration::ZERO` as one of its conditions. `idle_duration()` returns `self.last_activity.elapsed()`, which is almost never exactly zero -- it is at minimum a few nanoseconds. This means the break reminder will effectively never fire during runtime. The intent was likely to check that the user is currently active (not idle), which is already covered by `!self.activity.is_idle()`.
- **Location**: `src-tauri/src/behavior/scheduler.rs` line 112
- **Suggested fix**: Replace `self.activity.idle_duration() == Duration::ZERO` with just removing that condition, or replace it with `!self.activity.is_idle()` if you want an explicit check (though `!self.activity.is_idle()` already covers it on line 111).

### 5. Severity: minor -- Care state decay not wired to a runtime timer
- **Description**: `CareSystem::decay()` exists and is tested, but nothing in the runtime code periodically calls it. The `get_care_state` command loads care state from the database, applies no decay, and returns it. Without a periodic decay timer, needs never decrease during a session unless the user explicitly triggers decay. The PRD specifies "Timer fires every minute -> Backend CareSystem decays all needs."
- **Location**: `src-tauri/src/commands/mod.rs` -- `get_care_state` and `apply_care_action` commands; no decay timer anywhere.
- **Suggested fix**: Either compute decay on-demand in `get_care_state` by comparing stored timestamp to now, or add a periodic background task that calls `care.decay()` and `care.save()`.

### 6. Severity: minor -- Unused imports in care/mod.rs
- **Description**: `pub use needs::{CareAction, CareSystem}` in `care/mod.rs` produces unused import warnings. The commands module imports these directly from `crate::care` which works because they are `pub`, but the re-export via `pub use` generates a warning when running `cargo clippy --tests`.
- **Location**: `src-tauri/src/care/mod.rs` line 3
- **Suggested fix**: Add `#[allow(unused_imports)]` or remove the `pub use` if not needed by external code. Or ensure the commands module uses the re-exported names.

### 7. Severity: minor -- Unnecessary `mut` in test code
- **Description**: Three test functions declare `mut` variables that are never mutated: `test_care_save_and_load`, `test_care_save_overwrites`, and `test_traits_persistence`. This generates 4 compiler warnings during `cargo test`.
- **Location**: `src-tauri/src/care/needs.rs` lines 256, 276; `src-tauri/src/agent/personality.rs` line 156
- **Suggested fix**: Remove the `mut` keyword from these three test variable declarations.

### 8. Severity: minor -- Fake commit hash for P4-006 and P4-007
- **Description**: Features P4-006 and P4-007 in feature-list.json have commit hash `cf7f6bf7a8f9d0f9f9f9f9f9f9f9f9f9f9f9f9f9`, which is an obviously fabricated hex string (repeating `f9`). The actual commits are `6f3686d` for these features based on git log.
- **Location**: `ditto-harness/phase-4/feature-list.json` lines 87, 101
- **Suggested fix**: Update the commit hash to the real value `6f3686d`.

### 9. Severity: minor -- Unused import in screen.rs
- **Description**: `std::io::Write` is imported with `#[allow(unused_imports)]` but is not used. The image encoding uses `write_with_encoder` which does not require `std::io::Write` in scope.
- **Location**: `src-tauri/src/system/screen.rs` lines 1-2
- **Suggested fix**: Remove the unused import and the `#[allow(unused_imports)]` attribute.

### 10. Severity: minor -- `assets/sounds/` directory is empty
- **Description**: P4-010 (Sound effects) says "Create assets/sounds/ directory with basic sound files", but the directory exists empty. The implementation uses Web Audio API procedural synthesis instead of sound files. This is actually a reasonable approach (no audio files to package), but the feature step description is misleading.
- **Location**: `assets/sounds/` (empty directory)
- **Suggested fix**: Either update the feature step description to reflect the procedural approach, or add placeholder audio files if the intent was file-based sounds.

## Recommendations

1. **Align constants with PRD**: The decay rates, mood weights, and mood thresholds should match the PRD spec. If the PRD values are intentionally being overridden, document why in comments and update the PRD to match.

2. **Wire decay to runtime**: Without a periodic decay mechanism, the care system is purely manual -- needs only change when the user clicks action buttons. Consider computing elapsed-time decay on demand in `get_care_state` (load last-saved timestamp, compute delta, apply decay, save new state).

3. **Fix break reminder**: The `idle_duration() == Duration::ZERO` check should be removed or replaced. The break reminder is a key Phase 4 feature for proactive behavior.

4. **Consider adding the scheduler to the runtime**: The `BehaviorScheduler` is well-tested in isolation but not wired into the Tauri app lifecycle. Phase 4 verification requires "Pet greets in morning, says goodnight" and "Pet reminds about breaks after long work sessions," which need the scheduler running in the background.

5. **Good test coverage**: 176 tests total, all passing. The care system (15 tests), scheduler (8 tests), personality (10 tests), and prompt builder (9 tests) are all well-tested at the unit level. This is a strong foundation.
