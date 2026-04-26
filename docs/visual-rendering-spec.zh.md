# Ditto — 视觉渲染架构规范

> **版本：** 1.0
> **日期：** 2026-04-24
> **状态：** 提案
> **替代：** PRD 第 5 节（精灵与动画规范）、第 10.3 节（Canvas 2D）、第 10.4 节（已排除的替代方案）

---

## 1. 设计目标

| 目标 | 描述 |
|------|------|
| **多渲染器支持** | 多种 2D 渲染引擎（Sprite、Spine、Live2D、Lottie、VRM）在同一应用中共存 |
| **Agent-皮肤解耦** | 每个 Agent 绑定一个皮肤；皮肤决定渲染器类型；Agent 状态与皮肤完全隔离 |
| **无缝换肤** | Agent 可在运行时切换皮肤——行为、记忆和位置保持连续 |
| **Steam 创意工坊友好** | 低门槛格式（Sprite）支持社区创作；高端格式（Live2D）支持付费 DLC |
| **性能隔离** | 每个 Agent 窗口独立渲染；一个渲染器崩溃不影响其他 Agent |

---

## 2. 架构总览

### 2.1 核心原则

**皮肤是状态的投影，而非状态本身。**

```
Agent（有状态，持久化）              皮肤 / 渲染器（无状态，可替换）
┌───────────────────────┐             ┌──────────────────────┐
│ position: (500, 800)  │             │                      │
│ state: 'walk_right'   │──协议───→   │  f(state) → 视觉输出  │
│ mood: 72              │             │                      │
│ expression: 'happy'   │             └──────────────────────┘
│ mouthOpen: 0.6        │                  ↑ 可随时替换
│ memory, personality...│                  ↑ 销毁旧的 → 创建新的
└───────────────────────┘                  ↑ 回放当前状态 → 视觉连续
```

Agent 持有所有有意义的状态。渲染器是一个**纯函数**：给定 `(state, expression, mouthOpen, ...)`，产出视觉输出。换肤意味着替换这个函数——输入保持不变。

### 2.2 多 Agent 窗口隔离

```
                  ┌─────────────────────────────────┐
                  │        Ditto App (Rust)          │
                  │                                  │
                  │  Agent 管理器                     │
                  │    ├── Agent "Ditto"  (sprite)   │
                  │    ├── Agent "Luna"   (live2d)   │
                  │    └── Agent "Pixel"  (spine)    │
                  │                                  │
                  │  共享服务                          │
                  │    ├── AI / LLM (rig-core)       │
                  │    ├── 记忆 / 数据库 (SQLite)     │
                  │    ├── 照料系统                    │
                  │    └── 行为状态机                   │
                  └─────────────────────────────────┘
                            ↕ IPC（按 Agent 分隔）
           ┌────────────────┼────────────────┐
           ↓                ↓                ↓
      ┌──────────┐    ┌──────────┐    ┌──────────┐
      │ 窗口 A    │    │ 窗口 B    │    │ 窗口 C    │
      │ Canvas 2D │    │  WebGL    │    │  WebGL    │
      │  Sprite   │    │  Live2D   │    │  Spine    │
      │  64x64    │    │ 256x256   │    │ 200x200   │
      └──────────┘    └──────────┘    └──────────┘
```

**关键架构决策：一个 Agent 在任意时刻只使用一个渲染器。** 渲染器之间不共享 Canvas、不共享渲染上下文、不在运行时进行多路复用。这从结构上消除了所有 Canvas 2D / WebGL 上下文互斥冲突。

每个 Agent 窗口拥有：
- 自己的 HTML 文档
- 自己的 Canvas 元素（独立选择上下文类型）
- 自己的渲染器实例
- 自己的 `PetController`
- 自己的 `ClickThroughHandler`（委托给 `renderer.hitTest()`）
- 自己的 `DragHandler`
- 自己的 `requestAnimationFrame` 循环

---

## 3. 核心协议：PetRenderer 接口

### 3.1 协议定义

```typescript
// ============================================================
// 核心协议 — 所有渲染器必须实现
// ============================================================

interface PetRenderer {
  /** 渲染器类型标识 */
  readonly type: RendererType;

  /** 从清单加载皮肤资源 */
  load(manifest: SkinManifest): Promise<void>;

  /** 设置动画状态（映射到 Ditto FSM 的 PetState） */
  setState(state: PetState): void;

  /** 命中测试：给定 canvas 局部坐标，返回该点是否在角色的不透明区域上 */
  hitTest(x: number, y: number): boolean;

  /** 每帧更新。dt 单位为毫秒。 */
  update(dt: number): void;

  /** 返回此渲染器拥有的 Canvas 元素（用于 DOM 挂载） */
  getCanvas(): HTMLCanvasElement;

  /** 查询此渲染器支持的可选能力 */
  capabilities(): RendererCapabilities;

  /** 销毁渲染器并释放所有资源 */
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

### 3.2 可选能力接口

```typescript
/** 嘴巴张开度驱动，用于语音 / AI 语音输出 */
interface LipSyncable {
  /** 0.0（闭合）到 1.0（完全张开） */
  setMouthOpenness(value: number): void;
}

/** 命名表情，支持可选的混合权重 */
interface Expressible {
  setExpression(name: string, weight?: number): void;
}

/** 直接模型参数控制（Live2D ParamAngleX、Spine IK 等） */
interface ParameterDrivable {
  setParameter(name: string, value: number): void;
  getParameter(name: string): number;
}
```

### 3.3 类型守卫

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

### 3.4 渲染器能力矩阵

| 能力 | Sprite | Spine | Live2D | Lottie | VRM |
|------|:------:|:-----:|:------:|:------:|:---:|
| `setState()` | 帧序列切换 | 动画轨道播放 | Motion3 队列 | 状态机事件输入 | 动画片段播放 |
| `hitTest()` | `getImageData` alpha | 包围盒 / 附件 | CubismModel hitArea | Rive 风格边界 | Raycaster |
| `lipSync` | 否 | 可通过插槽替换实现 | 原生：`ParamMouthOpenY` | 否 | BlendShape 视素 |
| `expressionBlending` | 否 | 部分：轨道混合 | 原生：表情混合 | 否 | VRM Expression 系统 |
| `parameterDriving` | 否 | IK 约束、插槽 | 完整参数控制 | 状态机输入 | 否 |
| `physics` | 否 | 否 | 原生：头发/衣物 | 否 | SpringBone |
| `multiLayer` | 身体 + 表情 + 配饰图层 | 不适用（内建） | 不适用（内建） | 否 | 不适用（内建） |

### 3.5 换肤流程

```typescript
async function changeSkin(agent: Agent, newSkin: SkinManifest): Promise<void> {
  // 1. 快照当前 Agent 状态
  const snapshot = {
    state: agent.controller.getState(),
    position: agent.controller.getPosition(),
    expression: agent.currentExpression,
    mouthOpen: agent.currentMouthValue,
  };

  // 2. 淡出（150ms）
  await fadeOut(agent.window, 150);

  // 3. 销毁旧渲染器
  agent.renderer.destroy();

  // 4. 创建新渲染器
  agent.renderer = RendererFactory.create(newSkin.renderer);
  await agent.renderer.load(newSkin);

  // 5. 将状态回放到新渲染器上
  agent.renderer.setState(snapshot.state);
  if (isExpressible(agent.renderer) && snapshot.expression) {
    agent.renderer.setExpression(snapshot.expression);
  }
  if (isLipSyncable(agent.renderer)) {
    agent.renderer.setMouthOpenness(snapshot.mouthOpen);
  }

  // 6. 淡入（150ms）— 视觉连续
  await fadeIn(agent.window, 150);
}
```

---

## 4. 渲染器后端规范

### 4.1 SpriteRenderer（Canvas 2D，增强版）

| 属性 | 值 |
|------|---|
| **渲染上下文** | Canvas 2D |
| **核心依赖** | 无（原生 Canvas API） |
| **皮肤格式** | PNG 图集 + `animations.json` |
| **典型分辨率** | 64x64 到 256x256 |
| **空闲 CPU** | < 1% |
| **RAM 开销** | < 5MB |
| **模型文件大小** | 10KB - 500KB |
| **透明度** | `clearRect` — 天然透明 |
| **创意工坊创作门槛** | 极低 — 画 PNG + 写 JSON |
| **迁移路径** | 将当前 `SpriteEngine` 包装为 `PetRenderer` 实现 |

**相比当前 SpriteEngine 的增强计划：**
- 多图层合成（身体 + 表情 + 配饰作为独立精灵图）
- 分辨率提升至 256x256
- 每个动画 12-30 帧（从当前的 8 帧提升）
- Canvas 2D 粒子效果（星星、Zzz、爱心）
- 动画状态间的过渡帧支持

**命中测试实现：**

```typescript
hitTest(x: number, y: number): boolean {
  if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) return false;
  return this.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] >= 10;
}
```

### 4.2 SpineRenderer（spine-canvas / spine-pixi）

| 属性 | 值 |
|------|---|
| **渲染上下文** | Canvas 2D（`spine-canvas`）或 WebGL（`spine-pixi`） |
| **核心依赖** | `@esotericsoftware/spine-canvas` 或 `@esotericsoftware/spine-pixi-v8` |
| **皮肤格式** | `.skel`（二进制）或 `.json` + `.atlas` + 纹理 |
| **典型分辨率** | 128x128 到 300x300 |
| **空闲 CPU** | 1-2% |
| **RAM 开销** | 10-25MB |
| **模型文件大小** | 500KB - 3MB |
| **透明度** | Canvas 2D：天然透明；WebGL：`alpha: true` |
| **口型同步** | 通过插槽附件替换嘴型；或动画混合 |
| **骨骼变形** | 原生 — 网格变形、IK 约束、路径约束 |
| **创意工坊创作门槛** | 中高 — 需要 Spine Editor（Essential $79 / Professional $379） |
| **许可证** | 编辑器：一次性购买；运行时：持有许可证即可免版税分发 |

**运行时选择指南：**
- `spine-canvas`：更轻量，Canvas 2D 上下文，默认透明。最适合较简单的 Spine 模型。不支持网格变形混合模式。
- `spine-pixi`：通过 PixiJS WebGL 提供完整功能集。高级网格变形、双色着色、混合模式所必需。与 Live2D 渲染器共享 PixiJS 依赖（潜在优化点）。

**版本约束：** 运行时的 `major.minor` 版本必须与导出资源的 Spine Editor 版本匹配（例如运行时 `4.2.x` 要求编辑器 `4.2.x` 导出）。

**状态映射：**

```typescript
setState(state: PetState): void {
  const animName = this.skinManifest.state_map[state];
  if (!animName) return;
  // 在轨道 0 上设置动画，混合时长 0.2 秒
  this.animationState.setAnimation(0, animName, state !== 'fall');
}
```

**命中测试实现：**

```typescript
hitTest(x: number, y: number): boolean {
  // 使用 Spine 的包围盒附件或骨骼边界
  this.skeletonBounds.update(this.skeleton, true);
  return this.skeletonBounds.containsPoint(x, y) !== null;
}
```

### 4.3 Live2DRenderer（PixiJS + pixi-live2d-display）

| 属性 | 值 |
|------|---|
| **渲染上下文** | WebGL（PixiJS） |
| **核心依赖** | `pixi.js@6` + `pixi-live2d-display@0.4` + `live2dcubismcore.min.js` |
| **皮肤格式** | `.moc3` + 纹理 + `motions/` + `expressions/` + `model.model3.json` |
| **典型分辨率** | 256x256 到 512x512 |
| **空闲 CPU** | 2-4% |
| **RAM 开销** | 30-60MB |
| **模型文件大小** | 2MB - 15MB |
| **透明度** | WebGL `alpha: true, premultipliedAlpha: false`（需要在 Tauri 中进行 PoC 验证） |
| **口型同步** | 原生 — `ParamMouthOpenY` 参数驱动 |
| **物理模拟** | 原生 — 头发、衣物、配饰物理模拟 |
| **表情混合** | 原生 — CubismExpressionManager 多表情加权混合 |
| **创意工坊创作门槛** | 高 — 需要 Live2D Cubism Editor |
| **许可证** | 独立开发者：$500/年（年收入 < $1M）；运行时可嵌入分发 |

**关键版本锁定：**
- `pixi.js` 必须使用 v6（v7+ 与 `pixi-live2d-display@0.4` 不兼容）
- 替代方案：`@seayoo-web/pixi-live2d`（社区重新封装，支持 PixiJS v7+）
- `live2dcubismcore.min.js` 必须打包（Cubism 4 Core 二进制文件）
- 需要调用 `Live2DModel.registerTicker(PIXI.Ticker)` 以更新动画
- 必须全局暴露 `window.PIXI = PIXI`，供插件内部查找

**macOS 透明配置（Rust 侧）：**

```rust
// 通过 cocoa/objc crate 设置 NSWindow 透明
window.set_opaque(false);
window.set_background_color(NSColor::clearColor());
window.set_has_shadow(false);
// collectionBehavior: CanJoinAllSpaces | Stationary | IgnoresCycle
```

**状态映射：**

```typescript
setState(state: PetState): void {
  const motionGroup = this.skinManifest.state_map[state];
  if (!motionGroup) return;
  this.model.motion(motionGroup, 0, MotionPriority.NORMAL);
}

// 口型同步：由音频振幅分析驱动
setMouthOpenness(value: number): void {
  this.model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', value);
}
```

**命中测试实现：**

```typescript
hitTest(x: number, y: number): boolean {
  return this.model.hitTest('Body', x, y);
}
```

### 4.4 LottieRenderer（dotlottie-web）— 可选

| 属性 | 值 |
|------|---|
| **渲染上下文** | Canvas 2D |
| **核心依赖** | `@lottiefiles/dotlottie-web` |
| **皮肤格式** | `.lottie` 文件（打包动画 + 状态机 + 资源） |
| **典型分辨率** | 矢量 — 可缩放至任意尺寸 |
| **空闲 CPU** | < 1% |
| **RAM 开销** | < 10MB |
| **模型文件大小** | 20KB - 100KB |
| **透明度** | Canvas 2D 天然透明 |
| **状态机** | 内建 — `.lottie` 文件内的可视化节点状态机 |
| **口型同步** | 有限 — 通过状态机切换帧段 |
| **创意工坊创作门槛** | 低-中 — After Effects + Bodymovin，或 Lottie Creator（免费版可用） |
| **许可证** | 运行时开源免费；Lottie Creator 有免费版 |

**适用场景：**
- 超轻量角色（贴纸风格、表情包风格）
- 熟悉 After Effects 工作流的设计师
- 文件大小低于 100KB — 对分发体积影响可忽略

**状态映射：**

```typescript
setState(state: PetState): void {
  this.dotLottie.setStateMachineBooleanInput('is_' + state, true);
}
```

### 4.5 VRMRenderer（Three.js + @pixiv/three-vrm）— 可选

| 属性 | 值 |
|------|---|
| **渲染上下文** | WebGL（Three.js） |
| **核心依赖** | `three` + `@pixiv/three-vrm` + `GLTFLoader` |
| **皮肤格式** | `.vrm` 文件（基于 glTF 的 3D 人形角色） |
| **典型分辨率** | 200x200 到 400x400 |
| **空闲 CPU** | 3-5% |
| **RAM 开销** | 60-100MB |
| **模型文件大小** | 5MB - 30MB |
| **透明度** | Three.js 渲染器的 WebGL `alpha: true` |
| **口型同步** | BlendShape 视素映射（`aa`、`ih`、`ou`、`ee`、`oh`） |
| **表情混合** | VRM Expression 系统，支持加权混合 |
| **物理模拟** | VRM SpringBone（头发、配饰） |
| **创意工坊创作门槛** | 中 — VRoid Studio 免费且易于上手 |
| **许可证** | Three.js MIT + @pixiv/three-vrm MIT — 完全免费 |

**小视口桌面宠物的优化要求：**
- 固定正面朝向摄像机，禁用轨道控制
- 禁用阴影、后处理、抗锯齿
- 纹理降至 512px
- 移除不可见骨骼（内部牙齿、舌头）
- 尽可能合并骨骼对象（根据研究可获 800%+ 性能提升）
- 目标：200px 视口，30FPS 足够（桌面宠物不需要 60FPS）

**适用场景：**
- "3D 桌面宠物" DLC / 创意工坊高级内容
- 用户导入自己的 VRoid Hub 模型
- VTuber 生态集成（VRM 是开放标准）

---

## 5. 皮肤包格式（Skin Manifest）

### 5.1 统一清单：`skin.json`

每个皮肤包根目录下包含一个 `skin.json`，声明渲染器类型并提供渲染器特定的配置。

**Sprite 皮肤示例：**

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

**Spine 皮肤示例：**

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

**Live2D 皮肤示例：**

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

**Lottie 皮肤示例：**

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

**VRM 皮肤示例：**

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

### 5.2 目录结构示例

```
skins/
├── pixel-cat/                     # Sprite 皮肤
│   ├── skin.json
│   ├── preview.png
│   ├── spritesheet.png
│   └── animations.json
│
├── knight-pet/                    # Spine 皮肤
│   ├── skin.json
│   ├── preview.png
│   ├── skeleton.json
│   ├── skeleton.atlas
│   └── textures/
│       └── skeleton.png
│
├── luna-vtuber/                   # Live2D 皮肤
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
├── bouncy-blob/                   # Lottie 皮肤
│   ├── skin.json
│   ├── preview.png
│   └── pet.lottie
│
└── chibi-avatar/                  # VRM 皮肤
    ├── skin.json
    ├── preview.png
    └── avatar.vrm
```

---

## 6. 已排除的方案

| 框架 | 排除原因 |
|------|---------|
| **Rive** | 生态不足 — 与 Spine 和 Live2D 相比，社区模型和有经验的创作者稀缺。Spine 以更大的现有资源库（来自独立游戏社区）填补了中端骨骼动画的角色。 |
| **Phaser** | 是游戏框架，不是渲染格式。它不定义可用于创意工坊内容的资源格式。其内部渲染能力（精灵、Spine）已被专用的、更轻量的渲染器后端覆盖。引入 Phaser 会增加 ~800KB+ 的包体积，却没有带来新的视觉能力。 |
| **DragonBones** | 截至 2026 年该项目实际已停止维护。已更名为 "LoongBones" 并转向付费模式。Web 运行时已过时。社区建议使用 Spine 作为替代。 |

---

## 7. 实施阶段

| 阶段 | 内容 | 工期 | 交付物 |
|------|------|------|--------|
| **A** | 从 `SpriteEngine` 中提取 `PetRenderer` 接口。分离游戏循环。重构 `ClickThroughHandler` 和 `DragHandler`，使其依赖 `renderer.hitTest()` 而非直接读取 Canvas 2D 像素。将 `SpriteEngine` 包装为实现 `PetRenderer` 的 `SpriteRenderer`。 | 1 周 | 架构就绪，无功能变化 |
| **B** | 实现 `SpineRenderer`。集成 `@esotericsoftware/spine-canvas`（或 `spine-pixi`）。将 PetState 映射到 Spine 动画。通过骨骼边界实现命中测试。 | 1 周 | 首个骨骼动画后端可用 |
| **C** | 实现 `Live2DRenderer`。集成 PixiJS v6 + `pixi-live2d-display`。在 Windows 和 macOS 的 Tauri 上验证 WebGL 透明度（PoC）。将 PetState 映射到动作/表情。通过 `ParamMouthOpenY` 实现口型同步。 | 2 周 | VTuber 级渲染可用 |
| **D** | 皮肤系统：`skin.json` 解析、`RendererFactory`、皮肤浏览和切换的设置 UI、多 Agent 窗口管理。 | 1 周 | 完整皮肤生态就绪 |
| **E**（可选） | 根据需要添加 `LottieRenderer`、`VRMRenderer` 或 `SpineRenderer` 变体（`spine-pixi` 完整功能）。 | 每个 3-5 天 | 生态扩展 |

---

## 8. 性能预算（每个 Agent）

| 渲染器 | 空闲 CPU | RAM | 模型文件大小 | 窗口尺寸 |
|--------|---------|-----|-------------|---------|
| Sprite | < 1% | < 10MB | < 500KB | 64-256px |
| Spine | 1-2% | 10-25MB | 0.5-3MB | 128-300px |
| Live2D | 2-4% | 30-60MB | 2-15MB | 256-512px |
| Lottie | < 1% | < 10MB | < 100KB | 任意（矢量） |
| VRM | 3-5% | 60-100MB | 5-30MB | 200-400px |

多 Agent 场景的总预算 = 各 Agent 预算之和。默认应限制同时运行的 Agent 数量（例如 3 个），可在设置中配置。

---

## 9. Steam 内容层级

```
收入模型：

            ▲  Live2D / VRM 高级 DLC ($2-5)
           ╱ ╲    官方 / 专业创作者，最高视觉保真度
          ╱   ╲
         ╱ Spine ╲  官方中端主题（免费或低价 DLC）
        ╱  Lottie  ╲
       ╱─────────────╲
      ╱    Sprite     ╲  Steam 创意工坊社区免费内容（核心生态）
     ╱    Community    ╲
    ╱───────────────────╲
```

**各渲染器的创意工坊创作门槛：**

| 渲染器 | 所需工具 | 费用 | 目标创作者 |
|--------|---------|------|-----------|
| Sprite | 任意图像编辑器 | 免费 | 任何人 |
| Lottie | After Effects / Lottie Creator | 有免费版 | 动效设计师 |
| Spine | Spine Editor | $79（Essential）/ $379（Pro），一次性购买 | 游戏开发者 / 动画师 |
| Live2D | Cubism Editor | $500/年（独立开发者） | 专业 Live2D 美术师 |
| VRM | VRoid Studio | 免费 | 3D 角色爱好者 |

---

## 10. 风险评估

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|---------|
| Live2D PixiJS v6 版本锁定 | 中 | `pixi-live2d-display` 与 PixiJS v7+ 不兼容 | 使用 `@seayoo-web/pixi-live2d` 社区重新封装；Live2D 在隔离窗口中运行，不影响其他渲染器 |
| Live2D WebGL 透明度在 Tauri 中失败 | 中 | Live2D 皮肤不可用 | 在阶段 C 第一天进行 PoC 验证；降级方案：渲染到离屏 WebGL，通过 `drawImage` 复制到 Canvas 2D |
| 多窗口 Tauri 资源消耗 | 中 | 3+ Agent 推高总 RAM | 默认限制并发 Agent 数量；Sprite Agent 超轻量，混合类型以平衡总预算 |
| Spine Editor 许可证对创意工坊的要求 | 中 | 比 Sprite 更高的社区创作门槛 | 明确文档说明 Sprite 是主要的创意工坊格式；Spine 皮肤作为"高级创意工坊"层级；提供 Spine 模板项目 |
| Spine 运行时版本必须匹配编辑器导出版本 | 低 | 资源/运行时不匹配导致加载失败 | 在显著位置记录版本约束；在 `skin.json` 加载器中验证版本 |
| 多渲染器维护成本 | 中 | 后端增长时测试面增大 | 严格的协议接口隔离；每个渲染器独立的集成测试；按需添加后端，而非一次全部添加 |
| Cubism SDK 年费 | 低 | 每年 $500 的持续成本 | Steam DLC 收入可覆盖；仅在实际发布 Live2D 皮肤时才需要许可证 |
| VRM/Three.js 性能超出预算 | 低 | 3D Agent 在低端机器上过重 | 明确传达每 Agent 预算；VRM Agent 可单独禁用；为模型作者提供优化指南 |

---

## 11. 与现有 PRD 的关系

本规范**替代**以下 PRD 章节：

| PRD 章节 | 被替代为 |
|----------|---------|
| 第 5 节 — 精灵与动画规范 | 本规范第 3-5 节（多渲染器协议、所有后端规范、皮肤格式） |
| 第 10.3 节 — 为何选择 Canvas 2D | 本规范第 2 节 + 第 4 节（Canvas 2D 现在是五个渲染器后端之一，而非唯一的渲染策略） |
| 第 10.4 节 — 考虑并排除的替代技术 | 本规范第 6 节（部分此前被排除的技术现已作为渲染器后端接受；排除列表已更新） |

所有其他 PRD 章节保持不变：
- 第 3 节（核心功能）— 不变
- 第 4.1-4.2 节（技术栈、系统架构）— 架构有所扩展但不矛盾
- 第 6 节（AI Agent 规范）— 不变
- 第 7 节（照料系统规范）— 不变
- 第 8 节（分阶段交付计划）— 本规范中的实施阶段扩展了原有的 5 阶段计划
- 第 11 节（非功能性需求）— 本规范中的每 Agent 性能预算细化但不矛盾于 PRD 目标
