# Ditto — Visual Rendering Architecture Spec

> **Version:** 1.0
> **Date:** 2026-04-24
> **Status:** Proposal
> **Supersedes:** PRD Section 5 (Sprite & Animation Specification), Section 10.3 (Canvas 2D), Section 10.4 (Alternatives Rejected)

---

## 1. Design Goals

| Goal | Description |
|------|-------------|
| **Multi-renderer support** | Multiple 2D rendering engines (Sprite, Spine, Live2D, Lottie, VRM) coexist in the same application |
| **Agent-Skin decoupling** | Each Agent binds to one Skin; the Skin determines the renderer type; Agent state and Skin are fully isolated |
| **Seamless skin swap** | Agents can switch Skins at runtime — behavior, memory, and position remain continuous |
| **Steam Workshop friendly** | Low-barrier formats (Sprite) enable community creation; high-end formats (Live2D) support paid DLC |
| **Performance isolation** | Each Agent window renders independently; one renderer crash does not affect other Agents |

---

## 2. Architecture Overview

### 2.1 Core Principle

**The skin is a projection of state, not the state itself.**

```
Agent (stateful, persistent)          Skin / Renderer (stateless, replaceable)
┌───────────────────────┐             ┌──────────────────────┐
│ position: (500, 800)  │             │                      │
│ state: 'walk_right'   │──protocol──→│  f(state) → visual   │
│ mood: 72              │             │                      │
│ expression: 'happy'   │             └──────────────────────┘
│ mouthOpen: 0.6        │                  ↑ replaceable at any time
│ memory, personality...│                  ↑ destroy old → create new
└───────────────────────┘                  ↑ replay current state → visual continuity
```

The Agent holds all meaningful state. The renderer is a **pure function**: given `(state, expression, mouthOpen, ...)`, it produces visual output. Swapping skins means swapping this function — the inputs remain unchanged.

### 2.2 Multi-Agent Window Isolation

```
                  ┌─────────────────────────────────┐
                  │        Ditto App (Rust)          │
                  │                                  │
                  │  Agent Manager                   │
                  │    ├── Agent "Ditto"  (sprite)   │
                  │    ├── Agent "Luna"   (live2d)   │
                  │    └── Agent "Pixel"  (spine)    │
                  │                                  │
                  │  Shared Services                 │
                  │    ├── AI / LLM (rig-core)       │
                  │    ├── Memory / DB (SQLite)      │
                  │    ├── Care System               │
                  │    └── Behavior FSM              │
                  └─────────────────────────────────┘
                            ↕ IPC (per-agent)
           ┌────────────────┼────────────────┐
           ↓                ↓                ↓
      ┌──────────┐    ┌──────────┐    ┌──────────┐
      │ Window A  │    │ Window B  │    │ Window C  │
      │ Canvas 2D │    │  WebGL    │    │  WebGL    │
      │  Sprite   │    │  Live2D   │    │  Spine    │
      │  64x64    │    │ 256x256   │    │ 200x200   │
      └──────────┘    └──────────┘    └──────────┘
```

**Key architectural decision: one Agent uses exactly one renderer at any point in time.** Renderers never share a Canvas, never share a rendering context, and never multiplex at runtime. This eliminates all Canvas 2D / WebGL context mutual-exclusion conflicts by construction.

Each Agent window owns:
- Its own HTML document
- Its own Canvas element (with independently chosen context type)
- Its own renderer instance
- Its own `PetController`
- Its own `ClickThroughHandler` (delegating to `renderer.hitTest()`)
- Its own `DragHandler`
- Its own `requestAnimationFrame` loop

---

## 3. Core Protocol: PetRenderer Interface

### 3.1 Protocol Definition

```typescript
// ============================================================
// Core Protocol — all renderers MUST implement
// ============================================================

interface PetRenderer {
  /** Renderer type identifier */
  readonly type: RendererType;

  /** Load skin assets from a manifest */
  load(manifest: SkinManifest): Promise<void>;

  /** Set the animation state (maps to Ditto FSM PetState) */
  setState(state: PetState): void;

  /** Hit test: given canvas-local coordinates, returns true if the point
   *  is over an opaque region of the character */
  hitTest(x: number, y: number): boolean;

  /** Per-frame update. dt is in milliseconds. */
  update(dt: number): void;

  /** Returns the Canvas element owned by this renderer (for DOM mounting) */
  getCanvas(): HTMLCanvasElement;

  /** Query which optional capabilities this renderer supports */
  capabilities(): RendererCapabilities;

  /** Destroy the renderer and release all resources */
  destroy(): void;
}

type RendererType = 'sprite' | 'spine' | 'live2d' | 'lottie' | 'vrm';

type PetState =
  | 'idle' | 'walk_left' | 'walk_right'
  | 'run_left' | 'run_right'
  | 'climb' | 'fall' | 'drag'
  | 'curious' | 'sit' | 'sleep'
  | 'talk' | 'happy' | 'sad'
  | 'eat' | 'play';

interface RendererCapabilities {
  lipSync: boolean;
  expressionBlending: boolean;
  parameterDriving: boolean;
  physics: boolean;
  multiLayer: boolean;
}
```

### 3.2 Optional Capability Interfaces

```typescript
/** Mouth-open driving for speech / AI voice output */
interface LipSyncable {
  /** 0.0 (closed) to 1.0 (fully open) */
  setMouthOpenness(value: number): void;
}

/** Named expression with optional blend weight */
interface Expressible {
  setExpression(name: string, weight?: number): void;
}

/** Direct model parameter control (Live2D ParamAngleX, Spine IK, etc.) */
interface ParameterDrivable {
  setParameter(name: string, value: number): void;
  getParameter(name: string): number;
}
```

### 3.3 Type Guards

```typescript
function isLipSyncable(r: PetRenderer): r is PetRenderer & LipSyncable {
  return r.capabilities().lipSync;
}

function isExpressible(r: PetRenderer): r is PetRenderer & Expressible {
  return r.capabilities().expressionBlending;
}

function isParameterDrivable(r: PetRenderer): r is PetRenderer & ParameterDrivable {
  return r.capabilities().parameterDriving;
}
```

### 3.4 Renderer Capability Matrix

| Capability | Sprite | Spine | Live2D | Lottie | VRM |
|-----------|:------:|:-----:|:------:|:------:|:---:|
| `setState()` | Frame sequence switch | Animation track play | Motion3 queue | SM event input | Animation clip play |
| `hitTest()` | `getImageData` alpha | Bounding box / attachment | CubismModel hitArea | Rive-style bounds | Raycaster |
| `lipSync` | false | Possible via slot swap | Native: `ParamMouthOpenY` | false | BlendShape viseme |
| `expressionBlending` | false | Partial: track mixing | Native: Expression blend | false | VRM Expression system |
| `parameterDriving` | false | IK constraints, slots | Full parameter control | SM inputs | false |
| `physics` | false | false | Native: hair/cloth | false | SpringBone |
| `multiLayer` | body + expression + accessory layers | N/A (built-in) | N/A (built-in) | false | N/A (built-in) |

### 3.5 Skin Swap Flow

```typescript
async function changeSkin(agent: Agent, newSkin: SkinManifest): Promise<void> {
  // 1. Snapshot current agent state
  const snapshot = {
    state: agent.controller.getState(),
    position: agent.controller.getPosition(),
    expression: agent.currentExpression,
    mouthOpen: agent.currentMouthValue,
  };

  // 2. Fade out (150ms)
  await fadeOut(agent.window, 150);

  // 3. Destroy old renderer
  agent.renderer.destroy();

  // 4. Create new renderer
  agent.renderer = RendererFactory.create(newSkin.renderer);
  await agent.renderer.load(newSkin);

  // 5. Replay state onto new renderer
  agent.renderer.setState(snapshot.state);
  if (isExpressible(agent.renderer) && snapshot.expression) {
    agent.renderer.setExpression(snapshot.expression);
  }
  if (isLipSyncable(agent.renderer)) {
    agent.renderer.setMouthOpenness(snapshot.mouthOpen);
  }

  // 6. Fade in (150ms) — visual continuity
  await fadeIn(agent.window, 150);
}
```

---

## 4. Renderer Backend Specifications

### 4.1 SpriteRenderer (Canvas 2D, Enhanced)

| Property | Value |
|----------|-------|
| **Rendering context** | Canvas 2D |
| **Core dependencies** | None (native Canvas API) |
| **Skin format** | PNG atlas + `animations.json` |
| **Typical resolution** | 64x64 to 256x256 |
| **CPU idle** | < 1% |
| **RAM overhead** | < 5MB |
| **Model file size** | 10KB - 500KB |
| **Transparency** | `clearRect` — naturally transparent |
| **Workshop authoring barrier** | Minimal — draw PNG + write JSON |
| **Migration path** | Wrap current `SpriteEngine` as `PetRenderer` implementation |

**Enhancement plan over current SpriteEngine:**
- Multi-layer compositing (body + expression + accessory as independent sprite sheets)
- Resolution up to 256x256
- 12-30 frames per animation (up from current 8)
- Canvas 2D particle effects (stars, Zzz, hearts)
- Transition frame support between animation states

**Hit test implementation:**

```typescript
hitTest(x: number, y: number): boolean {
  if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) return false;
  return this.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] >= 10;
}
```

### 4.2 SpineRenderer (spine-canvas / spine-pixi)

| Property | Value |
|----------|-------|
| **Rendering context** | Canvas 2D (`spine-canvas`) or WebGL (`spine-pixi`) |
| **Core dependencies** | `@esotericsoftware/spine-canvas` or `@esotericsoftware/spine-pixi-v8` |
| **Skin format** | `.skel` (binary) or `.json` + `.atlas` + textures |
| **Typical resolution** | 128x128 to 300x300 |
| **CPU idle** | 1-2% |
| **RAM overhead** | 10-25MB |
| **Model file size** | 500KB - 3MB |
| **Transparency** | Canvas 2D: naturally transparent; WebGL: `alpha: true` |
| **Lip sync** | Slot attachment swap for mouth shapes; or animation mixing |
| **Skeletal deformation** | Native — mesh deformation, IK constraints, path constraints |
| **Workshop authoring barrier** | Medium-high — requires Spine Editor ($79 Essential / $379 Professional) |
| **License** | Editor: one-time purchase; Runtime: royalty-free distribution when license held |

**Runtime selection guidance:**
- `spine-canvas`: Lighter, Canvas 2D context, transparent by default. Best for simpler Spine models. Does not support mesh deformation blend modes.
- `spine-pixi`: Full feature set via PixiJS WebGL. Required for advanced mesh deformation, two-color tinting, blend modes. Shares PixiJS dependency with Live2D renderer (potential optimization).

**Version constraint:** The `major.minor` version of the runtime MUST match the Spine Editor version used to export assets (e.g., runtime `4.2.x` requires editor `4.2.x` exports).

**State mapping:**

```typescript
setState(state: PetState): void {
  const animName = this.skinManifest.state_map[state];
  if (!animName) return;
  // Set animation on track 0, with 0.2s mix duration
  this.animationState.setAnimation(0, animName, state !== 'fall');
}
```

**Hit test implementation:**

```typescript
hitTest(x: number, y: number): boolean {
  // Use Spine's bounding box attachments or skeleton bounds
  this.skeletonBounds.update(this.skeleton, true);
  return this.skeletonBounds.containsPoint(x, y) !== null;
}
```

### 4.3 Live2DRenderer (PixiJS + pixi-live2d-display)

| Property | Value |
|----------|-------|
| **Rendering context** | WebGL (PixiJS) |
| **Core dependencies** | `pixi.js@6` + `pixi-live2d-display@0.4` + `live2dcubismcore.min.js` |
| **Skin format** | `.moc3` + textures + `motions/` + `expressions/` + `model.model3.json` |
| **Typical resolution** | 256x256 to 512x512 |
| **CPU idle** | 2-4% |
| **RAM overhead** | 30-60MB |
| **Model file size** | 2MB - 15MB |
| **Transparency** | WebGL `alpha: true, premultipliedAlpha: false` (requires PoC validation with Tauri) |
| **Lip sync** | Native — `ParamMouthOpenY` parameter driving |
| **Physics** | Native — hair, clothing, accessory physics simulation |
| **Expression blending** | Native — CubismExpressionManager multi-expression weighted blending |
| **Workshop authoring barrier** | High — requires Live2D Cubism Editor |
| **License** | Indie: $500/year (annual revenue < $1M); runtime embeddable for distribution |

**Critical version pinning:**
- `pixi.js` MUST use v6 (v7+ incompatible with `pixi-live2d-display@0.4`)
- Alternative: `@seayoo-web/pixi-live2d` (community re-wrap supporting PixiJS v7+)
- `live2dcubismcore.min.js` MUST be bundled (Cubism 4 Core binary)
- `Live2DModel.registerTicker(PIXI.Ticker)` required for animation updates
- `window.PIXI = PIXI` must be exposed globally for plugin internal lookups

**macOS transparency configuration (Rust side):**

```rust
// NSWindow transparency setup via cocoa/objc crates
window.set_opaque(false);
window.set_background_color(NSColor::clearColor());
window.set_has_shadow(false);
// collectionBehavior: CanJoinAllSpaces | Stationary | IgnoresCycle
```

**State mapping:**

```typescript
setState(state: PetState): void {
  const motionGroup = this.skinManifest.state_map[state];
  if (!motionGroup) return;
  this.model.motion(motionGroup, 0, MotionPriority.NORMAL);
}

// Lip sync: driven from audio amplitude analysis
setMouthOpenness(value: number): void {
  this.model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', value);
}
```

**Hit test implementation:**

```typescript
hitTest(x: number, y: number): boolean {
  return this.model.hitTest('Body', x, y);
}
```

### 4.4 LottieRenderer (dotlottie-web) — Optional

| Property | Value |
|----------|-------|
| **Rendering context** | Canvas 2D |
| **Core dependencies** | `@lottiefiles/dotlottie-web` |
| **Skin format** | `.lottie` file (bundles animation + state machine + assets) |
| **Typical resolution** | Vector — scales to any size |
| **CPU idle** | < 1% |
| **RAM overhead** | < 10MB |
| **Model file size** | 20KB - 100KB |
| **Transparency** | Canvas 2D naturally transparent |
| **State machine** | Built-in — visual node-based state machine inside `.lottie` file |
| **Lip sync** | Limited — frame segment switching via state machine |
| **Workshop authoring barrier** | Low-medium — After Effects + Bodymovin, or Lottie Creator (free tier) |
| **License** | Runtime open-source free; Lottie Creator free tier available |

**Applicable scenarios:**
- Ultra-lightweight characters (sticker style, emoji style)
- Designers familiar with After Effects workflow
- File sizes under 100KB — negligible impact on distribution

**State mapping:**

```typescript
setState(state: PetState): void {
  this.dotLottie.setStateMachineBooleanInput('is_' + state, true);
}
```

### 4.5 VRMRenderer (Three.js + @pixiv/three-vrm) — Optional

| Property | Value |
|----------|-------|
| **Rendering context** | WebGL (Three.js) |
| **Core dependencies** | `three` + `@pixiv/three-vrm` + `GLTFLoader` |
| **Skin format** | `.vrm` file (glTF-based 3D humanoid avatar) |
| **Typical resolution** | 200x200 to 400x400 |
| **CPU idle** | 3-5% |
| **RAM overhead** | 60-100MB |
| **Model file size** | 5MB - 30MB |
| **Transparency** | WebGL `alpha: true` on Three.js renderer |
| **Lip sync** | BlendShape viseme mapping (`aa`, `ih`, `ou`, `ee`, `oh`) |
| **Expression blending** | VRM Expression system with weighted blending |
| **Physics** | VRM SpringBone (hair, accessories) |
| **Workshop authoring barrier** | Medium — VRoid Studio is free and accessible |
| **License** | Three.js MIT + @pixiv/three-vrm MIT — fully free |

**Optimization requirements for small-viewport desktop pet:**
- Fixed front-facing camera, disable orbit controls
- Disable shadows, post-processing, anti-aliasing
- Reduce textures to 512px
- Remove non-visible bones (internal teeth, tongue)
- Merge skeletal objects where possible (800%+ performance gain per research)
- Target: 200px viewport, 30FPS sufficient (desktop pet does not need 60FPS)

**Applicable scenarios:**
- "3D desktop pet" DLC / Workshop premium content
- Users importing their own VRoid Hub models
- VTuber ecosystem integration (VRM is an open standard)

---

## 5. Skin Package Format (Skin Manifest)

### 5.1 Unified Manifest: `skin.json`

Every skin package contains a `skin.json` at the root that declares its renderer type and provides renderer-specific configuration.

**Sprite skin example:**

```json
{
  "schema_version": "1.0",
  "name": "Pixel Cat",
  "author": "community_user",
  "version": "1.0.0",
  "renderer": "sprite",
  "preview": "preview.png",
  "size": { "width": 200, "height": 200 },

  "sprite": {
    "spritesheet": "spritesheet.png",
    "config": "animations.json",
    "layers": ["body", "expression", "accessory"]
  },

  "state_map": {
    "idle": "idle",
    "walk_left": "walk_left",
    "walk_right": "walk_right",
    "fall": "fall",
    "sleep": "sleep",
    "talk": "talk",
    "happy": "happy",
    "sad": "sad"
  }
}
```

**Spine skin example:**

```json
{
  "schema_version": "1.0",
  "name": "Knight Pet",
  "author": "game_artist",
  "version": "1.0.0",
  "renderer": "spine",
  "preview": "preview.png",
  "size": { "width": 200, "height": 200 },

  "spine": {
    "skeleton": "skeleton.json",
    "atlas": "skeleton.atlas"
  },

  "state_map": {
    "idle": "idle",
    "walk_left": "walk",
    "walk_right": "walk",
    "run_left": "run",
    "run_right": "run",
    "sleep": "sleep",
    "talk": "talk",
    "happy": "happy",
    "sad": "sad",
    "fall": "fall",
    "drag": "drag"
  }
}
```

**Live2D skin example:**

```json
{
  "schema_version": "1.0",
  "name": "Luna VTuber",
  "author": "official",
  "version": "1.0.0",
  "renderer": "live2d",
  "preview": "preview.png",
  "size": { "width": 300, "height": 300 },

  "live2d": {
    "model": "model.model3.json"
  },

  "state_map": {
    "idle": "Idle",
    "walk_left": "WalkLeft",
    "walk_right": "WalkRight",
    "talk": "Talk",
    "happy": "Happy",
    "sad": "Sad",
    "sleep": "Sleep"
  },

  "expression_map": {
    "happy": "f_happy.exp3.json",
    "sad": "f_sad.exp3.json",
    "surprised": "f_surprised.exp3.json"
  }
}
```

**Lottie skin example:**

```json
{
  "schema_version": "1.0",
  "name": "Bouncy Blob",
  "author": "designer",
  "version": "1.0.0",
  "renderer": "lottie",
  "preview": "preview.png",
  "size": { "width": 150, "height": 150 },

  "lottie": {
    "file": "pet.lottie"
  },

  "state_map": {
    "idle": "is_idle",
    "walk_left": "is_walking_left",
    "walk_right": "is_walking_right",
    "sleep": "is_sleeping",
    "happy": "is_happy",
    "sad": "is_sad"
  }
}
```

**VRM skin example:**

```json
{
  "schema_version": "1.0",
  "name": "Chibi Avatar",
  "author": "vroid_user",
  "version": "1.0.0",
  "renderer": "vrm",
  "preview": "preview.png",
  "size": { "width": 300, "height": 300 },

  "vrm": {
    "model": "avatar.vrm"
  },

  "state_map": {
    "idle": "Idle",
    "walk_left": "Walk",
    "walk_right": "Walk",
    "sleep": "Sleep",
    "talk": "Talk",
    "happy": "Happy"
  },

  "expression_map": {
    "happy": "happy",
    "sad": "sad",
    "surprised": "surprised"
  }
}
```

### 5.2 Directory Structure Examples

```
skins/
├── pixel-cat/                     # Sprite skin
│   ├── skin.json
│   ├── preview.png
│   ├── spritesheet.png
│   └── animations.json
│
├── knight-pet/                    # Spine skin
│   ├── skin.json
│   ├── preview.png
│   ├── skeleton.json
│   ├── skeleton.atlas
│   └── textures/
│       └── skeleton.png
│
├── luna-vtuber/                   # Live2D skin
│   ├── skin.json
│   ├── preview.png
│   ├── model.model3.json
│   ├── model.moc3
│   ├── textures/
│   │   └── texture_00.png
│   ├── motions/
│   │   ├── Idle.motion3.json
│   │   ├── WalkLeft.motion3.json
│   │   └── Talk.motion3.json
│   └── expressions/
│       ├── f_happy.exp3.json
│       └── f_sad.exp3.json
│
├── bouncy-blob/                   # Lottie skin
│   ├── skin.json
│   ├── preview.png
│   └── pet.lottie
│
└── chibi-avatar/                  # VRM skin
    ├── skin.json
    ├── preview.png
    └── avatar.vrm
```

---

## 6. Excluded Approaches

| Framework | Reason for Exclusion |
|-----------|---------------------|
| **Rive** | Insufficient ecosystem — community models and experienced creators are scarce compared to Spine and Live2D. Spine fills the mid-tier skeletal animation role with a much larger existing asset base from the indie game community. |
| **Phaser** | A game framework, not a rendering format. It does not define an asset format usable for Workshop content. Its internal rendering capabilities (sprites, Spine) are already covered by dedicated, lighter-weight renderer backends. Introducing Phaser adds ~800KB+ bundle size with no new visual capability. |
| **DragonBones** | Project is effectively unmaintained as of 2026. Rebranded as "LoongBones" with a pivot to paid model. Web runtimes are obsolete. Community recommends Spine as the replacement. |

---

## 7. Implementation Phases

| Phase | Content | Duration | Deliverable |
|-------|---------|----------|-------------|
| **A** | Extract `PetRenderer` interface from `SpriteEngine`. Separate GameLoop. Refactor `ClickThroughHandler` and `DragHandler` to depend on `renderer.hitTest()` instead of direct Canvas 2D pixel reads. Wrap `SpriteEngine` as `SpriteRenderer` implementing `PetRenderer`. | 1 week | Architecture ready, no functional change |
| **B** | Implement `SpineRenderer`. Integrate `@esotericsoftware/spine-canvas` (or `spine-pixi`). Map PetState to Spine animations. Implement hit test via skeleton bounds. | 1 week | First skeletal animation backend available |
| **C** | Implement `Live2DRenderer`. Integrate PixiJS v6 + `pixi-live2d-display`. Validate WebGL transparency in Tauri on Windows and macOS (PoC). Map PetState to motions/expressions. Implement lip sync via `ParamMouthOpenY`. | 2 weeks | VTuber-grade rendering available |
| **D** | Skin system: `skin.json` parsing, `RendererFactory`, settings UI for skin browsing and swapping, multi-Agent window management. | 1 week | Full skin ecosystem operational |
| **E** (optional) | Add `LottieRenderer`, `VRMRenderer`, or `SpineRenderer` variant (`spine-pixi` full features) as needed. | 3-5 days each | Ecosystem expansion |

---

## 8. Performance Budget (Per-Agent)

| Renderer | CPU idle | RAM | Model file size | Window size |
|---------|---------|-----|----------------|-------------|
| Sprite | < 1% | < 10MB | < 500KB | 64-256px |
| Spine | 1-2% | 10-25MB | 0.5-3MB | 128-300px |
| Live2D | 2-4% | 30-60MB | 2-15MB | 256-512px |
| Lottie | < 1% | < 10MB | < 100KB | any (vector) |
| VRM | 3-5% | 60-100MB | 5-30MB | 200-400px |

Total budget in multi-Agent scenarios = sum of individual Agent budgets. The default should limit simultaneously running Agents (e.g., 3), configurable in settings.

---

## 9. Steam Content Tiers

```
Revenue model:

            ▲  Live2D / VRM Premium DLC ($2-5)
           ╱ ╲    Official / professional creator, highest visual fidelity
          ╱   ╲
         ╱ Spine ╲  Official mid-tier themes (free or low-price DLC)
        ╱  Lottie  ╲
       ╱─────────────╲
      ╱    Sprite     ╲  Steam Workshop community free content (core ecosystem)
     ╱    Community    ╲
    ╱───────────────────╲
```

**Workshop authoring barrier by renderer:**

| Renderer | Tool Required | Cost | Target Creator |
|----------|--------------|------|---------------|
| Sprite | Any image editor | Free | Anyone |
| Lottie | After Effects / Lottie Creator | Free tier available | Motion designers |
| Spine | Spine Editor | $79 (Essential) / $379 (Pro), one-time | Game developers / animators |
| Live2D | Cubism Editor | $500/year (Indie) | Professional Live2D artists |
| VRM | VRoid Studio | Free | 3D character hobbyists |

---

## 10. Risk Assessment

| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| Live2D PixiJS v6 version lock | Medium | `pixi-live2d-display` incompatible with PixiJS v7+ | Use `@seayoo-web/pixi-live2d` community re-wrap; Live2D runs in isolated window, does not affect other renderers |
| Live2D WebGL transparency fails in Tauri | Medium | Live2D skins unusable | PoC validation on day 1 of Phase C; fallback: render to offscreen WebGL, copy to Canvas 2D via `drawImage` |
| Multi-window Tauri resource consumption | Medium | 3+ Agents push total RAM high | Limit concurrent Agents by default; Sprite Agents are ultra-lightweight, mix types to balance total budget |
| Spine Editor license requirement for Workshop | Medium | Higher barrier than Sprite for community creators | Clearly document that Sprite is the primary Workshop format; Spine skins as "advanced Workshop" tier; provide Spine template projects |
| Spine runtime version must match editor export | Low | Asset/runtime mismatch causes load failure | Document version constraint prominently; validate version in `skin.json` loader |
| Multiple renderer maintenance cost | Medium | Increased test surface as backends grow | Strict protocol interface isolation; independent integration tests per renderer; add backends on-demand, not all at once |
| Cubism SDK annual license fee | Low | $500/year ongoing cost | Steam DLC revenue covers it; license only needed when actually shipping Live2D skins |
| VRM/Three.js performance exceeds budget | Low | 3D Agent too heavy on low-end machines | Per-Agent budget clearly communicated; VRM Agents can be individually disabled; optimization guide for model authors |

---

## 11. Relationship to Existing PRD

This spec **supersedes** the following PRD sections:

| PRD Section | Superseded By |
|-------------|--------------|
| Section 5 — Sprite & Animation Specification | This spec, Sections 3-5 (multi-renderer protocol, all backend specs, skin format) |
| Section 10.3 — Why Canvas 2D | This spec, Section 2 + Section 4 (Canvas 2D is now one of five renderer backends, not the sole rendering strategy) |
| Section 10.4 — Alternative Technologies Considered and Rejected | This spec, Section 6 (some previously rejected technologies are now accepted as renderer backends; rejection list updated) |

All other PRD sections remain unchanged:
- Section 3 (Core Features) — unchanged
- Section 4.1-4.2 (Technology Stack, System Architecture) — architecture expanded but not contradicted
- Section 6 (AI Agent Specification) — unchanged
- Section 7 (Care System Specification) — unchanged
- Section 8 (Phased Delivery Plan) — implementation phases in this spec extend beyond the original 5-phase plan
- Section 11 (Non-Functional Requirements) — per-Agent performance budgets in this spec refine but do not contradict PRD targets
