# Phase 5 Evaluation Report

## Scores
- Feature completeness: 7/10
- Correctness: 8/10
- Code quality: 6/10
- PRD alignment: 8/10

## Overall verdict: FAIL

## Issues found

### 1. Clippy fails with zero-warnings policy violated
- Severity: **critical**
- Description: `cargo clippy -- -D warnings` fails with an unnecessary cast error. The project's CLAUDE.md mandates zero warnings: `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`.
- Location: `src-tauri/src/commands/mod.rs:256` -- `now.hour() as u32` is an unnecessary cast since `chrono::Timelike::hour()` already returns `u32`.
- Suggested fix: Change `let hour = now.hour() as u32;` to `let hour = now.hour();`

### 2. `cargo fmt` check fails
- Severity: **critical**
- Description: `cargo fmt --check` reports formatting differences in multiple files. The project requires rustfmt-compliant code.
- Location: `src-tauri/src/commands/mod.rs`, `src-tauri/src/behavior/scheduler.rs`, `src-tauri/src/care/needs.rs`, `src-tauri/src/db/mod.rs`
- Suggested fix: Run `cargo fmt --manifest-path src-tauri/Cargo.toml` to auto-fix.

### 3. Feature list entries missing id and description
- Severity: **major**
- Description: Features at indices 1 through 8 (the 2nd through 9th entries) in `feature-list.json` are missing their `id` and `description` fields. They only have `passes: true` and a `commit` hash. This makes it impossible to verify what these 8 features actually are and whether they pass.
- Location: `ditto-harness/phase-5/feature-list.json`, entries at array positions 1-8
- Suggested fix: Fill in the `id` and `description` fields for all features. Per CLAUDE.md: "Never modify feature ids, descriptions, or steps in feature-list.json -- only `passes` and `commit`" -- but these entries were apparently created incomplete, which violates the schema used by the rest of the list.

### 4. Dead code annotations on core modules in lib.rs
- Severity: **minor**
- Description: `behavior`, `care`, `db`, `agent`, and `system` modules are annotated with `#[allow(dead_code)]` in `lib.rs`. This indicates that much of the Rust backend logic (state machine, care system, database, agent, etc.) is not wired to the runtime application at the call-site level. While the modules have tests, the dead_code annotations suppress what would otherwise be compiler warnings about unused public items, masking potential integration gaps.
- Location: `src-tauri/src/lib.rs:6-19`
- Suggested fix: These are acceptable during development but should be tracked. If the backend FSM and care system are intended to be authoritative sources of truth (per the architecture docs), they need to be wired through IPC in a future phase. If they are already partially wired (commands reference them), selectively remove the annotations where items are actually used.

### 5. `try_agent_response` function is dead code
- Severity: **minor**
- Description: The `try_agent_response` async function in commands/mod.rs is marked `#[allow(dead_code)]` and is never called. It appears to be a non-streaming alternative to `try_streaming_response` that was replaced during development.
- Location: `src-tauri/src/commands/mod.rs:160-180`
- Suggested fix: Remove if not planned for use, or add a comment explaining why it is kept.

### 6. Updater endpoint is empty
- Severity: **minor**
- Description: The auto-update feature (P5-010) is marked as passing, but `tauri.conf.json` has `"endpoints": []` and `"pubkey": ""` in the updater plugin config. Without a configured endpoint and public key, the updater cannot actually detect or install new versions. The feature infrastructure exists but is not functional.
- Location: `src-tauri/tauri.conf.json:52-55`
- Suggested fix: Either configure a real update endpoint and key, or mark P5-010 as requiring manual verification with a configured endpoint.

### 7. Sound module has unused variable
- Severity: **minor**
- Description: In `sound.ts`, `const ctx: AudioContext | null = null;` on line 3 is declared but never used. The actual variable is `audioCtx` on line 4.
- Location: `src/ui/sound.ts:3`
- Suggested fix: Remove the unused `ctx` declaration on line 3.

### 8. Frontend-backend FSM gap still present
- Severity: **minor**
- Description: As noted in CLAUDE.md's "Known Issues", the frontend `PetController` manages state unilaterally without using the backend state machine. The backend FSM (`state_machine.rs`) is well-tested with 33 tests but is not wired through IPC. This is a known architectural gap, not a Phase 5 regression, but worth noting for completeness.
- Location: `src/behavior/pet-controller.ts` vs `src-tauri/src/behavior/state_machine.rs`

### 9. Personality traits loaded as defaults, not from DB
- Severity: **minor**
- Description: In `send_chat_message` (commands/mod.rs:61), `PersonalityTraits::default()` is used instead of `PersonalityTraits::load(&db)`. This means the system prompt always uses default personality traits regardless of any evolution that has occurred. The `PersonalityTraits::load` and `save` methods exist and have tests but are not used at runtime.
- Location: `src-tauri/src/commands/mod.rs:61`
- Suggested fix: Replace `PersonalityTraits::default()` with `PersonalityTraits::load(&db).unwrap_or_default()` to persist and evolve personality across sessions.

### 10. Care system action values don't match PRD spec
- Severity: **minor**
- Description: The PRD specifies Pet/stroke gives Happiness +10 and Play gives Happiness +20, Energy -10. The implementation uses Pet=+20 and does not have a Play action. The Chat action gives +25 Social instead of the PRD's +15.
- Location: `src-tauri/src/care/needs.rs:158-163`
- Suggested fix: Align action values with PRD section 7.2, or update the PRD to match implementation.

## Recommendations

1. **Fix clippy and fmt before closing Phase 5.** These are CI-blocking issues. The project's own CI pipeline (`cargo clippy -D warnings`, `cargo fmt --check`) will fail on the current code.

2. **Fill in missing feature-list.json entries.** Eight features have no id or description. This makes the harness tracking unreliable and prevents automated verification of what those features cover.

3. **Wire personality persistence into the runtime path.** The `PersonalityTraits::load`/`save` methods are tested but unused. A one-line fix in `send_chat_message` would make personality actually persist across sessions.

4. **Consider adding capabilities configuration.** CLAUDE.md notes no `src-tauri/capabilities/` directory yet. As IPC commands grow, a capabilities file will be needed for Tauri v2 permissions.

5. **Accessibility (P5-017) needs keyboard testing.** The settings and onboarding panels use standard HTML form elements which get basic keyboard navigation for free. However, focus indicators, ARIA labels, and screen reader announcements should be verified manually since the CSS resets `outline` in some places.

6. **Performance features (P5-013, P5-014) are profiling-based** and cannot be verified by code review alone. These require manual measurement with the running application.
