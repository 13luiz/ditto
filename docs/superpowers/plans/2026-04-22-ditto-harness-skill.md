# Ditto Harness Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `/ditto-implement` Claude Code skill that drives long-running TDD-based implementation of the Ditto desktop pet PRD across 5 phases.

**Architecture:** A single skill markdown file with state detection, per-phase initializer/coder/evaluator logic, and TDD enforcement. The skill reads `ditto-harness/ditto-progress.json` to determine current state and follows one of three branches (initialize phase, implement features, or evaluate phase gate).

**Tech Stack:** Claude Code skill (markdown), JSON artifacts for progress tracking, Rust `cargo test` + Playwright MCP for verification.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `.claude/commands/ditto-implement.md` | The skill file — all harness logic as a Claude Code custom slash command |
| `ditto-harness/ditto-progress.json` | Master progress state — phase tracking, session summaries |
| `.gitignore` | Updated to ignore `.repos` (already) — no new entries needed |

The skill file is a **Claude Code custom slash command** — markdown files in `.claude/commands/` that are invoked as `/ditto-implement`. This is the standard mechanism for project-specific skills in Claude Code.

All other harness artifacts (`phase-N/feature-list.json`, `phase-N/phase-config.json`, `phase-N/phase-eval-report.md`) are **generated at runtime** by the skill itself — they are not created in this plan.

---

### Task 1: Create harness directory + initial progress state

**Files:**
- Create: `ditto-harness/ditto-progress.json`

- [ ] **Step 1: Create ditto-harness directory and initial progress file**

Create `ditto-harness/ditto-progress.json`:

```json
{
  "current_phase": 1,
  "phase_status": {
    "1": "pending",
    "2": "pending",
    "3": "pending",
    "4": "pending",
    "5": "pending"
  },
  "total_features_completed": 0,
  "total_features_remaining": 0,
  "last_session_summary": "Harness initialized. No work done yet.",
  "last_commit": ""
}
```

- [ ] **Step 2: Validate JSON**

Run: `cat ditto-harness/ditto-progress.json | python -m json.tool > /dev/null && echo "Valid JSON"`
Expected: `Valid JSON`

- [ ] **Step 3: Create .claude/commands directory**

Run: `mkdir -p .claude/commands`

- [ ] **Step 4: Commit**

```bash
git add ditto-harness/ditto-progress.json .claude/commands/
git commit -m "harness: initialize progress tracking and command directory"
```

---

### Task 2: Create skill file — frontmatter + state detection

**Files:**
- Create: `.claude/commands/ditto-implement.md`

- [ ] **Step 1: Write skill frontmatter and state detection section**

Create `.claude/commands/ditto-implement.md` with the following content:

```markdown
You are the Ditto Harness — a long-running implementation agent for the Ditto desktop pet project.

Your job is to drive TDD-based, phase-by-phase implementation of the Ditto desktop pet, following the PRD at `docs/PRD.md`.

You work in sessions. Each invocation of this command is one session. Between sessions, your state is preserved in `ditto-harness/` artifacts. You have no memory of previous sessions — you must read these artifacts to get your bearings.

## SESSION START — GET YOUR BEARINGS (MANDATORY)

Run these commands BEFORE doing anything else:

1. Run `pwd` to confirm you are in the Ditto project root directory.
2. Read `ditto-harness/ditto-progress.json` to determine:
   - `current_phase` — which phase (1-5) you're working on
   - `phase_status` — the status of each phase ("pending", "in_progress", "completed")
3. If `ditto-harness/phase-{current_phase}/` directory exists:
   - Read `ditto-harness/phase-{current_phase}/feature-list.json`
   - Count features with `"passes": false` — these are remaining work
4. Run `git log --oneline -20` to see recent history.
5. If `Cargo.toml` exists in `src-tauri/`, run `cd src-tauri && cargo test 2>&1; cd ..` to get a health baseline. If tests fail, you MUST fix them before doing any new work.
6. If `phase-config.json` exists for the current phase AND its `init_command` is set, verify the app can start (run the command, check for errors, then stop it).

After getting your bearings, determine which branch to follow:

- **Branch A**: Phase `phase_status` for `current_phase` is `"pending"` OR `ditto-harness/phase-{current_phase}/` does not exist → Run INITIALIZER (Section 1)
- **Branch B**: Phase status is `"in_progress"` AND features remain with `"passes": false` → Run CODER (Section 2)
- **Branch C**: Phase status is `"in_progress"` AND ALL features have `"passes": true` → Run EVALUATOR (Section 3)

## SECTION 1: INITIALIZER (Branch A)

You are initializing Phase {current_phase}. This is the first session for this phase.

### Step 1: Read the PRD

Read `docs/PRD.md`. Focus on:
- **Phase {current_phase}** section in "Phased Delivery Plan" (Section 8)
- **Phase {current_phase}** verification steps in "Technical Verification Plan" (Section 9)
- Any architecture or specification sections relevant to this phase

### Step 2: Assess the current codebase

- List existing project files: `find src-tauri/src -name "*.rs" 2>/dev/null`, `find src -name "*.ts" -o -name "*.html" 2>/dev/null`, `ls -la assets/ 2>/dev/null`
- Read key config files if they exist: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `package.json`
- If `Cargo.toml` exists, run `cargo test 2>&1` to record baseline test count

### Step 3: Generate feature-list.json

Create `ditto-harness/phase-{current_phase}/feature-list.json`.

For each verification checklist item in the PRD Phase {current_phase} section:
- Create a feature entry with:
  - `"id"`: `P{current_phase}-{NNN}` (zero-padded 3-digit sequence, starting at 001)
  - `"description"`: the verification test description from the PRD
  - `"category"`: `"functional"` or `"style"`
  - `"test_type"`: one of:
    - `"unit"` — for Rust logic tests (state machine, physics, mood calculations, data persistence)
    - `"visual"` — for UI/rendering tests that need Playwright screenshot verification
    - `"integration"` — for multi-component tests with external dependencies (LLM APIs, screen capture)
    - `"manual"` — for features requiring human judgment (system tray appearance, installer UX, persona quality)
    - `"profiling"` — for performance measurements (RAM usage, CPU usage, startup time)
  - `"steps"`: the test steps from the PRD verification checklist
  - `"passes"`: `false`
  - `"commit"`: `null`
- Order features by dependency: foundational ones first (e.g., project setup before sprite rendering, state machine before movement)

### Step 4: Generate phase-config.json

Create `ditto-harness/phase-{current_phase}/phase-config.json`:

```json
{
  "init_command": "cd src-tauri && cargo tauri dev",
  "test_command": "cd src-tauri && cargo test",
  "build_command": "cd src-tauri && cargo build",
  "playwright_checks": true,
  "phase_gate_criteria": [
    "All features in feature-list.json have passes: true",
    "Zero cargo test failures across full test suite",
    "Evaluator subagent review approved"
  ]
}
```

Adjust `init_command`, `test_command`, `build_command` based on the phase:
- Phase 1-2: standard cargo tauri commands
- Phase 3: add LLM connectivity check (verify API keys in `.env` or environment)
- Phase 4: add SQLite migration check
- Phase 5: add cross-platform build check (`cargo tauri build`)

### Step 5: Update progress and commit

- Update `ditto-harness/ditto-progress.json`:
  - Set `phase_status[current_phase]` to `"in_progress"`
  - Set `total_features_remaining` to the number of features in the new list
- Commit:
```bash
git add ditto-harness/
git commit -m "harness: initialize phase {current_phase} feature list ({count} features)"
```

### Step 6: Begin work

After initialization, immediately proceed to **SECTION 2: CODER** to start implementing the first feature.
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `head -5 .claude/commands/ditto-implement.md`
Expected: Shows the frontmatter content starting with "You are the Ditto Harness"

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/ditto-implement.md
git commit -m "harness: add skill frontmatter and state detection"
```

---

### Task 3: Add coder section with TDD enforcement

**Files:**
- Modify: `.claude/commands/ditto-implement.md` — append coder section

- [ ] **Step 1: Append the coder section to the skill file**

Append the following to `.claude/commands/ditto-implement.md`:

```markdown

## SECTION 2: CODER (Branch B)

You are implementing features for Phase {current_phase}. Work on ONE feature at a time.

### Step 1: Pick the next feature

Read `ditto-harness/phase-{current_phase}/feature-list.json`. Find the first feature with `"passes": false`.

Announce to the user:
> "Working on feature {id}: {description}"

### Step 2: TDD — Red Phase (Write Failing Test)

Based on the feature's `test_type`:

**For `"unit"` features:**
- Identify the appropriate Rust module in `src-tauri/src/` where this feature's logic lives
- Write a `#[test]` function that tests the specific behavior described in the feature's `steps`
- The test must assert a specific, verifiable outcome
- Run: `cd src-tauri && cargo test {test_name} 2>&1`
- Confirm the test FAILS (compilation error or assertion failure is acceptable)
- If the test does NOT fail, the test is wrong — rewrite it to actually test something meaningful

**For `"visual"` features:**
- Write a Playwright test script that navigates to the app and verifies the visual requirement
- Use Playwright MCP tools: `browser_navigate`, `browser_snapshot`, `browser_take_screenshot`
- Capture a screenshot showing the feature is NOT yet implemented (or the app doesn't start)
- This establishes the "red" baseline

**For `"integration"` features:**
- Write a test that exercises multiple components together
- Use mocks for external dependencies (LLM APIs) unless real credentials are available
- Run the test and confirm it FAILS

**For `"manual"` and `"profiling"` features:**
- Write a verification script or instructions that a human can follow
- For profiling: write a script that measures the target metric (e.g., startup time, memory usage)
- Document the expected threshold

Commit:
```bash
git add .
git commit -m "test: {feature_id} — failing test for {short_description}"
```

### Step 3: TDD — Green Phase (Make It Pass)

Write the MINIMUM code required to make the test pass. Do not over-engineer. Do not add features that aren't tested.

For Rust code:
- Add the implementation to the appropriate module
- If a new module is needed, create it and register it in `mod.rs`
- If new dependencies are needed, add them to `Cargo.toml`

For TypeScript/frontend code:
- Add the implementation to the appropriate file in `src/`
- If a new component is needed, create it

After writing the implementation:
1. Run the specific test: `cd src-tauri && cargo test {test_name} 2>&1`
2. Confirm it PASSES
3. Run the full test suite: `cd src-tauri && cargo test 2>&1`
4. Confirm NO regressions — all previously passing tests still pass
5. If any test breaks, fix the regression BEFORE proceeding

For `"visual"` features:
- Start the app using the phase's `init_command`
- Use Playwright MCP to navigate and verify the feature visually
- Take screenshots at each verification step
- Close the app

Commit:
```bash
git add .
git commit -m "feat: {feature_id} — implement {short_description}"
```

### Step 4: TDD — Refactor Phase (Clean Up)

Look at the code you just wrote. Ask:
- Is there obvious duplication?
- Are names clear?
- Is the code in the right file/module?

If cleanup is needed:
1. Make the changes
2. Run the full test suite: `cd src-tauri && cargo test 2>&1`
3. Confirm nothing broke
4. Commit:
```bash
git add .
git commit -m "refactor: {feature_id} — cleanup after implementation"
```

If no cleanup is needed, skip this step entirely.

### Step 5: Mark feature as passing

Update `ditto-harness/phase-{current_phase}/feature-list.json`:
- Find the feature by `id`
- Change `"passes": false` to `"passes": true`
- Set `"commit"` to the current git commit hash

Run: `git rev-parse HEAD` to get the commit hash.

**IMPORTANT:** You may ONLY change the `passes` and `commit` fields. Never modify `id`, `description`, `category`, `test_type`, or `steps`.

### Step 6: Update progress and decide next action

Update `ditto-harness/ditto-progress.json`:
- Increment `total_features_completed`
- Decrement `total_features_remaining`
- Update `last_session_summary` with what you accomplished
- Update `last_commit` with current hash

Now check: are there more features with `"passes": false`?

- **YES** → Go back to Step 1 and pick the next feature. Continue within this session if you have context room.
- **NO** → All features pass. Proceed to **SECTION 3: EVALUATOR**.

### Error Recovery During Coding

| Situation | Action |
|-----------|--------|
| `cargo test` fails at session start | Fix all failing tests before implementing anything new |
| New code breaks existing tests | Fix the regression immediately — do not proceed with new features |
| Cannot figure out how to implement | Commit what you have (even if test is still failing), update progress with blocker description, end session |
| Context is getting long | Commit current work, update progress, end session cleanly. Next session picks up where you left off. |
```

- [ ] **Step 2: Verify the file contains all three sections so far**

Run: `grep -c "SECTION" .claude/commands/ditto-implement.md`
Expected: `2` (Section 1 and Section 2)

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/ditto-implement.md
git commit -m "harness: add coder section with TDD enforcement"
```

---

### Task 4: Add evaluator section

**Files:**
- Modify: `.claude/commands/ditto-implement.md` — append evaluator section

- [ ] **Step 1: Append the evaluator section to the skill file**

Append the following to `.claude/commands/ditto-implement.md`:

```markdown

## SECTION 3: EVALUATOR (Branch C)

All features in Phase {current_phase} have `passes: true`. Before advancing to the next phase, the work must be evaluated.

### Step 1: Run full regression check

Run the complete test suite:
```bash
cd src-tauri && cargo test 2>&1
```

If ANY test fails:
- Do NOT proceed to evaluation
- Go back to **SECTION 2: CODER** Step 1
- Add the regression as a new feature to `feature-list.json`:
```json
{
  "id": "P{current_phase}-{highest_id + 1}",
  "description": "REGRESSION: {failing_test_description}",
  "category": "functional",
  "test_type": "unit",
  "steps": ["Run cargo test", "Verify no failures"],
  "passes": false,
  "commit": null
}
```

### Step 2: Spawn evaluator subagent

Use the Agent tool to spawn a general-purpose subagent for evaluation. The subagent prompt must be:

```
You are evaluating Phase {current_phase} of the Ditto desktop pet project for quality and completeness.

Read these files:
- ditto-harness/phase-{current_phase}/feature-list.json (all features and their status)
- docs/PRD.md (the full PRD — focus on Phase {current_phase} section)
- Key source files in src-tauri/src/ and src/

Then perform these checks:

1. **Feature completeness (40% weight):**
   - For each feature in feature-list.json with "passes": true, verify the feature is actually implemented
   - Run: cd src-tauri && cargo test 2>&1
   - For "visual" features: use Playwright MCP to navigate to the running app and take screenshots to verify
   - Flag any feature marked as passing but not actually working

2. **Correctness (30% weight):**
   - Read the source code for obvious bugs
   - Check error handling — do error paths crash or handle gracefully?
   - Check edge cases in state machine transitions, physics calculations, data handling
   - Run: cd src-tauri && cargo test 2>&1 — verify zero failures

3. **Code quality (20% weight):**
   - Does the code follow existing patterns in the codebase?
   - Any security issues (unsafe blocks without safety comments, unvalidated inputs at system boundaries)?
   - Reasonable abstractions — no premature over-engineering, no god objects
   - No dead code or unused imports

4. **PRD alignment (10% weight):**
   - Does the implementation match the INTENT of the PRD's Phase {current_phase} section?
   - Are there features the PRD describes that are missing from feature-list.json?

After checking, write your evaluation to ditto-harness/phase-{current_phase}/phase-eval-report.md in this format:

# Phase {current_phase} Evaluation Report

## Scores
- Feature completeness: X/10
- Correctness: X/10
- Code quality: X/10
- PRD alignment: X/10

## Overall verdict: PASS or FAIL

(FAIL if any criterion scores below 7/10)

## Issues found
(List each issue with:
- Severity: critical / major / minor
- Description: what's wrong
- Location: file and line if applicable
- Suggested fix: how to resolve)

## Recommendations
(Optional suggestions for improvement that don't block passing)
```

### Step 3: Process evaluation result

Read `ditto-harness/phase-{current_phase}/phase-eval-report.md`.

**If verdict is PASS:**

1. Update `ditto-harness/ditto-progress.json`:
   - Set `phase_status[current_phase]` to `"completed"`
   - If `current_phase < 5`: set `current_phase` to `{current_phase + 1}`
   - Update `last_session_summary`
   - Update `last_commit`

2. Commit:
```bash
git add ditto-harness/
git commit -m "harness: phase {current_phase} complete — evaluator approved"
```

3. Report to user:
> "Phase {current_phase} COMPLETE. Evaluation scores: completeness X/10, correctness X/10, quality X/10, PRD alignment X/10.
>
> Next: Phase {current_phase + 1}. Run /ditto-implement again to initialize the next phase."

**If verdict is FAIL:**

1. For each issue in the evaluation report, add a new feature to `ditto-harness/phase-{current_phase}/feature-list.json`:
```json
{
  "id": "P{current_phase}-{next_seq}",
  "description": "EVAL FIX: {issue description from report}",
  "category": "functional",
  "test_type": "{appropriate type based on issue}",
  "steps": [{steps from issue's suggested fix}],
  "passes": false,
  "commit": null
}
```

2. Update `ditto-harness/ditto-progress.json`:
   - Update `total_features_remaining` with new count
   - Update `last_session_summary` with: "Phase {current_phase} evaluation failed. {count} issues to fix."

3. Commit:
```bash
git add ditto-harness/
git commit -m "harness: phase {current_phase} eval failed — {count} issues to fix"
```

4. Report to user:
> "Phase {current_phase} evaluation FAILED. Scores: completeness X/10, correctness X/10, quality X/10, PRD alignment X/10.
>
> {count} issues added to feature list. Run /ditto-implement again to fix them."

5. Do NOT proceed to the next phase. The next session will enter Branch B (coder) and fix the issues.
```

- [ ] **Step 2: Verify section count**

Run: `grep -c "SECTION" .claude/commands/ditto-implement.md`
Expected: `3` (Section 1, 2, and 3)

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/ditto-implement.md
git commit -m "harness: add evaluator section with grading criteria"
```

---

### Task 5: Add session handoff + error recovery + harness invariants

**Files:**
- Modify: `.claude/commands/ditto-implement.md` — append session handoff section

- [ ] **Step 1: Append session handoff and invariants to the skill file**

Append the following to `.claude/commands/ditto-implement.md`:

```markdown

## SESSION END — CLEAN STATE (MANDATORY)

Before your session ends (whether naturally or because context is running low):

1. Ensure ALL file changes are committed:
```bash
git status
```
If there are uncommitted changes, commit them:
```bash
git add .
git commit -m "wip: {brief description of current state}"
```

2. Update `ditto-harness/ditto-progress.json`:
   - `last_session_summary`: what you accomplished, what's next, any blockers
   - `last_commit`: output of `git rev-parse HEAD`
   - `total_features_completed` and `total_features_remaining`: recount from feature-list.json

3. Report to user:
> "Session complete. Phase {N}: {completed}/{total} features done.
> Next feature: {id of next feature with passes: false, or 'Phase gate — run evaluator'}.
> Run /ditto-implement to continue."

## ERROR RECOVERY

| Situation | What to do |
|-----------|-----------|
| `cargo test` fails at session start | Fix all failing tests before implementing anything new. Commit fixes separately. |
| New code breaks existing tests | Fix the regression immediately. Do not proceed with new features. |
| Cannot figure out implementation | Commit what you have. Update progress with blocker. End session. Try a different approach next session. |
| Playwright MCP unavailable | Treat `visual` tests as `manual`. Take screenshots manually if possible, otherwise note in progress that visual verification is deferred. |
| LLM API unavailable (Phase 3+) | Use mock-based testing. Document that real API testing is deferred to manual verification. |
| Evaluator rejects phase | Add evaluator issues as new features. Fix in next session. Do NOT advance to next phase. |
| Context fills mid-feature | Commit current state (even if test is failing). Update progress noting the incomplete feature. Next session will pick it up. |

## HARNESS INVARIANTS — NEVER VIOLATE THESE

1. **Never remove or modify features.** Features in `feature-list.json` must never be deleted, reordered, or have their `description`, `steps`, `category`, `test_type`, or `id` changed. Only `passes` and `commit` may be updated.

2. **Only mark features passing after verification.** Change `passes: false → true` ONLY after:
   - For `unit`: `cargo test` confirms the test passes
   - For `visual`: Playwright screenshot confirms the UI matches the requirement
   - For `integration`: multi-component test passes
   - For `manual`: user has confirmed the feature works
   - For `profiling`: measurement meets the PRD's performance target

3. **Always run existing tests before new work.** At session start, run `cargo test`. If anything fails, fix it first. Never build on a broken foundation.

4. **One feature per session is acceptable.** Incremental progress is the goal. Completing one feature correctly is better than half-completing three.

5. **Leave the codebase clean.** Every session ends with all changes committed, no broken tests, and a clear progress summary. The next session (which may be run by a different agent instance with no memory) must be able to pick up seamlessly.

6. **Phase gates require evaluator approval.** You cannot self-approve a phase. The evaluator subagent must grade the work and return PASS before advancing.
```

- [ ] **Step 2: Verify the file has all required sections**

Run: `grep -c "SECTION\|SESSION END\|ERROR RECOVERY\|HARNESS INVARIANTS" .claude/commands/ditto-implement.md`
Expected: `6` or more (Sections 1-3, Session End, Error Recovery, Invariants)

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/ditto-implement.md
git commit -m "harness: add session handoff, error recovery, and invariants"
```

---

### Task 6: Add phase reference tables

**Files:**
- Modify: `.claude/commands/ditto-implement.md` — append phase reference

- [ ] **Step 1: Append phase reference to the skill file**

Append the following to `.claude/commands/ditto-implement.md`:

```markdown

## PHASE REFERENCE

Quick reference for each phase. The initializer uses this when generating phase artifacts.

### Phase 1 — Skeleton

- **Goal:** Pet appears on desktop with transparent window
- **PRD sections:** Section 8 "Phase 1 — Skeleton", Section 9.1 verification
- **Expected features:** ~8 (from PRD verification checklist items)
- **Test breakdown:** 5 visual, 2 unit, 1 manual
- **Init scaffolds:** Tauri v2 project (`npm create tauri-app@latest`), Cargo.toml with tauri dependency, tauri.conf.json with `transparent: true, decorations: false, alwaysOnTop: true`, `src/` with Canvas 2D sprite renderer, `assets/pets/default/` with sample spritesheet
- **Key dependencies:** tauri 2.x, Canvas 2D
- **Phase gate:** Pet visible on desktop, animating at target FPS, no window borders, click-through on transparent areas

### Phase 2 — Life

- **Goal:** Pet can move, interact, respond to input
- **PRD sections:** Section 8 "Phase 2 — Life", Section 9.2 verification
- **Expected features:** ~7
- **Test breakdown:** 4 unit, 2 visual, 1 manual
- **Init scaffolds:** `src-tauri/src/behavior/` module (state_machine.rs, movement.rs, cursor.rs, scheduler.rs), physics constants (gravity, velocity), screen boundary detection, `src/input/` module (drag.ts, click.ts)
- **Key dependencies:** Phase 1 complete, `rdev` crate (or `mouce` fallback)
- **Phase gate:** Pet walks autonomously, climbs edges, falls with gravity, can be grabbed/dragged, reacts to cursor proximity

### Phase 3 — Mind

- **Goal:** Pet can think, converse, remember
- **PRD sections:** Section 8 "Phase 3 — Mind", Section 9.3 verification
- **Expected features:** ~10
- **Test breakdown:** 4 unit, 4 integration, 1 visual, 1 manual
- **Init scaffolds:** `src-tauri/src/agent/` module (core.rs, tools.rs, memory.rs, personality.rs, prompt.rs), `src-tauri/src/db/` module (migrations.rs, models.rs), `src/ui/chat-bubble.ts`, `src/ipc/commands.ts`
- **Key dependencies:** Phase 2 complete, `rig-core` 0.34+, `rusqlite` 0.32+, `tokio` 1.x
- **Special handling:** Check for `.env` file or environment variables for LLM API keys. If missing, prompt user to configure before starting. Integration tests use mocks by default; real API testing requires explicit opt-in.
- **Phase gate:** User can chat with pet via text input, agent moves pet using tool calls, conversations persist across app restarts, local LLM (Ollama) and cloud (OpenAI/Anthropic) both work

### Phase 4 — Soul

- **Goal:** Pet has needs, awareness, depth
- **PRD sections:** Section 8 "Phase 4 — Soul", Section 9.4 verification
- **Expected features:** ~8
- **Test breakdown:** 3 unit, 2 integration, 1 visual, 2 manual
- **Init scaffolds:** `src-tauri/src/care/` module (needs.rs, mood.rs), `src-tauri/src/system/screen.rs`, `src-tauri/src/behavior/scheduler.rs` (time-based triggers), `src/ui/care-panel.ts`, `assets/sounds/` directory
- **Key dependencies:** Phase 3 complete, `screenshots` 0.7+ or `xcap` crate
- **Phase gate:** Needs decay over time, feeding/petting replenishes needs, mood affects animations and behavior, pet can describe what's on screen

### Phase 5 — Polish

- **Goal:** Production-ready application
- **PRD sections:** Section 8 "Phase 5 — Polish", Section 9.5 verification
- **Expected features:** ~12
- **Test breakdown:** 1 unit, 2 integration, 5 manual, 2 profiling, 2 manual-special
- **Init scaffolds:** `src-tauri/src/system/tray.rs`, `src-tauri/src/system/autolaunch.rs`, `src/ui/settings.ts`, `src/ui/onboarding.ts`, Tauri updater config in tauri.conf.json
- **Key dependencies:** All previous phases complete, `tray-icon` 0.19+, Tauri bundler
- **Phase gate:** App installs on Windows 10/11 and macOS 12+, system tray works on both platforms, <50MB RAM at idle, <5% CPU, works offline, auto-update detects new versions

### Total Estimate

| Phase | Features | Unit | Visual | Integration | Manual/Profiling |
|-------|----------|------|--------|-------------|------------------|
| 1 — Skeleton | ~8 | 2 | 5 | 0 | 1 |
| 2 — Life | ~7 | 4 | 2 | 0 | 1 |
| 3 — Mind | ~10 | 4 | 1 | 4 | 1 |
| 4 — Soul | ~8 | 3 | 1 | 2 | 2 |
| 5 — Polish | ~12 | 1 | 0 | 2 | 9 |
| **Total** | **~45** | **14** | **9** | **8** | **14** |
```

- [ ] **Step 2: Verify total line count is reasonable**

Run: `wc -l .claude/commands/ditto-implement.md`
Expected: ~350-450 lines (a comprehensive but focused skill file)

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/ditto-implement.md
git commit -m "harness: add phase reference tables for all 5 phases"
```

---

### Task 7: Verify the skill file structure and validate JSON references

**Files:**
- Modify: `.claude/commands/ditto-implement.md` (no changes expected)
- Validate: `ditto-harness/ditto-progress.json`

- [ ] **Step 1: Verify the skill file has all required sections**

Run:
```bash
echo "=== Section check ===" && grep "SECTION\|SESSION START\|SESSION END\|ERROR RECOVERY\|HARNESS INVARIANTS\|PHASE REFERENCE" .claude/commands/ditto-implement.md | head -20
```

Expected output should contain all of these headings:
- `SESSION START — GET YOUR BEARINGS`
- `SECTION 1: INITIALIZER`
- `SECTION 2: CODER`
- `SECTION 3: EVALUATOR`
- `SESSION END — CLEAN STATE`
- `ERROR RECOVERY`
- `HARNESS INVARIANTS`
- `PHASE REFERENCE`

- [ ] **Step 2: Validate ditto-progress.json is valid JSON**

Run: `cat ditto-harness/ditto-progress.json | python -m json.tool > /dev/null && echo "Valid JSON"`
Expected: `Valid JSON`

- [ ] **Step 3: Verify the skill file references correct artifact paths**

Run:
```bash
grep -c "ditto-harness/" .claude/commands/ditto-implement.md
```
Expected: 20+ references (the skill heavily references harness artifacts)

Run:
```bash
grep -c "docs/PRD.md" .claude/commands/ditto-implement.md
```
Expected: At least 2 references (initializer reads it, evaluator cross-references)

- [ ] **Step 4: Verify no placeholder text in the skill file**

Run:
```bash
grep -i "TBD\|TODO\|FIXME\|fill in\|implement later\|placeholder" .claude/commands/ditto-implement.md
```
Expected: No output (no placeholders found)

---

### Task 8: Add .gitignore entries and final commit

**Files:**
- Modify: `.gitignore`
- Verify: `.claude/commands/ditto-implement.md`
- Verify: `ditto-harness/ditto-progress.json`

- [ ] **Step 1: Verify .gitignore is appropriate**

Read `.gitignore`. The `ditto-harness/` directory SHOULD be tracked in git (it contains the project's harness state), so it should NOT be in `.gitignore`. Only `.repos` should be ignored (which it already is).

Run: `cat .gitignore`
Expected: Only `.repos` or similar entries. NOT `ditto-harness/`.

- [ ] **Step 2: Final verification — ensure all files exist and are committed**

Run:
```bash
echo "=== Files ===" && ls -la .claude/commands/ditto-implement.md ditto-harness/ditto-progress.json && echo "=== Git status ===" && git status
```

Expected:
- Both files exist
- `git status` shows clean working tree (or only unrelated changes like `docs/PRD.md`)

- [ ] **Step 3: Final commit if any uncommitted changes**

If `git status` shows uncommitted changes in harness files:
```bash
git add .claude/commands/ditto-implement.md ditto-harness/ditto-progress.json
git commit -m "harness: complete ditto-implement skill — ready for Phase 1"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Section | Plan Task |
|-------------|-----------|
| 2.1 File Structure | Task 1 (progress.json), Tasks 2-6 (skill generates the rest) |
| 2.2 ditto-progress.json | Task 1 |
| 2.3 feature-list.json schema | Task 2 (initializer generates) |
| 2.4 phase-config.json schema | Task 2 (initializer generates) |
| 3.1 Session Start — Get Bearings | Task 2 |
| 3.2 Branch A — Initializer | Task 2 |
| 3.3 Branch B — Coder | Task 3 |
| 3.4 Branch C — Evaluator | Task 4 |
| 3.5 Session End — Clean State | Task 5 |
| 4.1-4.3 TDD Red-Green-Refactor | Task 3 |
| 4.4 TDD Rules | Task 5 (invariants) |
| 5.1 Grading Criteria | Task 4 |
| 5.2 Evaluator Process | Task 4 |
| 5.3 Failure Handling | Task 4 |
| 6.1-6.5 Phase Details | Task 6 |
| 7.1 Phase Transition | Task 4 (evaluator) + Task 5 (handoff) |
| 7.2 Error Recovery | Task 5 |
| 7.3 Harness Invariants | Task 5 |
| 8.1-8.3 Skill Definition | Tasks 2-6 |

**Gaps:** None found. All spec sections map to plan tasks.

### 2. Placeholder Scan

No TBDs, TODOs, FIXMEs, "fill in", "implement later", or "placeholder" text in the plan. All code blocks contain complete content.

### 3. Type Consistency

- `feature-list.json` entries use `id: "P{N}-{NNN}"`, `passes: boolean`, `commit: string|null` — consistent across Tasks 2-4
- `ditto-progress.json` uses `current_phase: number`, `phase_status: object`, consistent across Tasks 1-5
- Evaluator report format defined once in Task 4 and referenced consistently
