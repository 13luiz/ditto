# Phase 6 Sprint Contract — Skin Foundation

> Target version: v0.1.5
> Reference: docs/PRD.md §11.1, §5, docs/visual-rendering-spec.md
> Estimated duration: 3 weeks

## Goal

Establish a multi-renderer architecture where the current `SpriteEngine` becomes one of potentially many `PetRenderer` implementations. Ship a working Spine renderer and a skin distribution system (manifest parsing, discovery, import, deletion). Unify the UI into a single Pet Manager window, replacing the standalone chat-bubble/care-panel/settings windows with Vue routes. This is the foundation for all future visual variety — every subsequent phase builds on the `PetRenderer` interface.

## Deliverables

- **New TypeScript interfaces**: `PetRenderer`, `RendererCapabilities`, `SkinManifest`, `RendererFactory` in `src/overlay/renderer/`
- **Refactored modules**: `SpriteEngine` wrapped as `SpriteRenderer` implementing `PetRenderer` (no behavior change)
- **New TypeScript module**: `SpineRenderer` in `src/overlay/renderer/spine-renderer.ts` using `@esotericsoftware/spine-canvas`
- **New TypeScript module**: `RendererFactory` in `src/overlay/renderer/renderer-factory.ts`
- **Renamed Rust module**: `system/themes.rs` → `system/skins.rs`
- **New Rust module content**: `skins.rs` with skin manifest parsing, discovery (bundled + user data dir), merged catalog
- **New IPC commands**: `list_skins`, `import_skin_zip`, `import_skin_url`, `delete_skin`, `get_active_skin`, `set_active_skin`
- **New Vue route**: `/skins` in Pet Manager with grid gallery, live preview, filter by renderer type, bond-lock display
- **Refactored UI**: Standalone window launchers (`chat-bubble.ts`, `care-panel.ts`, `settings.ts`) removed; Pet Manager window opens instead
- **New sample asset**: `public/skins/sample-spine/` with a Spine character demonstrating skeletal animation
- **Settings migration**: `active_skin` setting added; `list_themes` IPC renamed to `list_skins` with backward compat
- **Forward-compat scaffold**: `AgentBackend` trait stub in Rust (no behavior change, just the trait definition)

## Success criteria

1. `PetRenderer` TypeScript interface compiles and is importable; existing sprite tests continue to pass unchanged
2. `SpriteRenderer` wraps the current `SpriteEngine` logic implementing `PetRenderer`; overlay renders identically to v0.1.0
3. `RendererFactory.create('sprite', manifest)` returns a `SpriteRenderer`; `RendererFactory.create('spine', manifest)` returns a `SpineRenderer`; unsupported type throws descriptive error
4. `SkinManifest` TypeScript type matches the v1.0 schema from visual-rendering-spec §5.1; validation rejects missing required fields
5. `system/themes.rs` renamed to `system/skins.rs`; `list_themes` IPC replaced by `list_skins`; all v0.1.0 tests pass
6. `list_skins` IPC returns merged catalog from bundled skins (`public/skins/`) and user-installed skins (`$APPDATA/Ditto/skins/`)
7. `import_skin_zip` IPC validates skin.json presence + required fields, extracts to user data dir, and the new skin appears in `list_skins` output
8. `import_skin_url` IPC downloads a zip, validates, installs; skin appears in catalog
9. `delete_skin` removes a user-installed skin; bundled skins cannot be deleted
10. `get_active_skin` / `set_active_skin` persist the active skin ID per agent in settings DB
11. `SpineRenderer` loads a `.skel`/`.json` + `.atlas` + textures, plays animations mapped via `state_map`, and passes `hitTest` via skeleton bounds
12. Sample Spine skin in `public/skins/sample-spine/` loads and animates the idle state without flicker
13. `/skins` route renders a grid of installed skins with preview animations, renderer-type filter tabs, and bond-lock badges
14. Pet Manager window opens from tray menu; old standalone chat-bubble/care-panel/settings windows removed; all their UI lives as Pet Manager routes
15. Settings migration runs silently: existing settings load correctly with default skin reference added
16. All 222 v0.1.0 tests pass; new tests cover renderer factory, skin discovery, skin manifest validation, and Spine rendering
17. `AgentBackend` trait defined in Rust with `BuiltinAgent` marked as implementor (no behavior change beyond trait extraction)

## Verification methods

- **Unit tests** in `src-tauri/src/` (Rust): skin manifest parsing, discovery logic, import validation, settings migration, AgentBackend trait
- **Unit tests** in TypeScript (via vitest or tsc): PetRenderer interface compliance, RendererFactory dispatch, SkinManifest validation
- **Integration tests** in Rust: `list_skins` / `import_skin_zip` / `delete_skin` roundtrip with temp dirs
- **Visual tests** via Playwright MCP: `/skins` route renders grid, Spine skin animates, skin swap with fade
- **Manual checks**: Pet Manager window opens from tray, old windows gone, skin drag-drop install

## Out of scope (explicitly NOT this phase)

- Live2D renderer (Phase 8)
- Lottie / VRM renderers (post-v0.6.0)
- Bond level engine (Phase 7) — `/skins` route shows bond-lock UI but always unlocks since bond system doesn't exist yet
- InteractionRouter (Phase 7)
- Multi-agent window management (Phase 10)
- AgentBackend behavior changes (just the trait scaffold, no ExternalAgentChannel)

## Risks for this phase

- **Spine runtime version constraint**: The `major.minor` version of `@esotericsoftware/spine-canvas` MUST match the Spine Editor version used to export sample assets. Must validate early.
- **Spine sample asset creation**: Need a valid Spine-exported character. If no Spine Editor license is available, we need a CC0 sample or generate a minimal valid `.json` + `.atlas` + texture by hand.
- **WebGL context in Tauri transparent window**: Spine uses Canvas 2D by default (spine-canvas), so this should be safe. But if we ever need `spine-pixi` (WebGL), the transparent window needs PoC validation.
- **Pet Manager window consolidation**: Removing standalone windows and consolidating into one Vue SPA is a UX-breaking change — must verify all functionality is accessible through routes.
- **Skin import security**: `import_skin_zip` must validate path traversal (no `../` in zip entries) and size limits.

## Definition of "done"

The phase is done when:
1. All features in `feature-list.json` have `passes: true` and a `commit` hash
2. `cargo test` reports zero failures
3. `cargo clippy -- -D warnings` is clean
4. `cargo fmt --check` is clean
5. `npx tsc --noEmit` is clean
6. Evaluator subagent issues a PASS verdict
7. User confirms phase advance
