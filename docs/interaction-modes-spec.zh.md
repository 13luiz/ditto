# Ditto — 交互模式架构规范

> **版本：** 1.0
> **日期：** 2026-04-24
> **状态：** 提案
> **取代：** PRD 第 4.3 节（数据流 — 用户交互流程、AI 对话流程）

---

## 1. 设计目标

| 目标 | 描述 |
|------|------|
| **多模式共存** | 15 种交互模式在同一应用中共存；用户选择启用哪些模式 |
| **Agent-交互解耦** | Agent 输出（文本、工具调用、情绪）通过 InteractionRouter 路由；各模式独立渲染 |
| **渐进式干扰** | 从零干扰（Bark）到深度互动（Dialog Panel）分为五个层级；用户控制上限 |
| **渲染器无关** | 交互模式在 Sprite、Spine、Live2D、Lottie 和 VRM 渲染器下表现一致（参见 visual-rendering-spec.md） |
| **单宠完整，多 Agent 可扩展** | 全部 15 种模式可用于单个宠物；多 Agent 存在时激活短剧系统 |
| **用户可配置预设** | 预设配置文件（"极简"、"养成"、"RPG"）和逐模式开关让用户定制体验 |

---

## 2. 架构概览

### 2.1 核心原则

**交互模式是意图的投射，而非意图本身。**

```
                                                  交互模式
Agent / Care / FSM                                （无状态，可替换）
（有状态，权威源）                                ┌──────────────────────┐
┌───────────────────────┐                         │                      │
│ Agent 输出：          │                         │  Bark  Bubble  Panel │
│   text, tool_call,    │──InteractionRouter──>   │  Radial  Emote  VN   │
│   emotion, inner      │                         │  Command  Log  ...   │
│                       │                         │                      │
│ Care 状态：           │<──InteractionEvent───   │  f(output) → visual  │
│   hunger, mood, ...   │                         │  f(click)  → event   │
│                       │                         └──────────────────────┘
│ FSM 状态：            │                              ↑ 可替换
│   idle, walk, talk    │                              ↑ 用户可配置
└───────────────────────┘                              ↑ 渲染器无关
```

Agent/Care/FSM 持有所有有意义的状态。每个交互模式是一**对纯函数**：一个将系统输出映射为视觉呈现，另一个将用户手势映射为 `InteractionEvent`。切换模式只是切换这些函数——底层状态保持不变。

### 2.2 InteractionRouter

InteractionRouter 位于有状态后端与可视化交互模式之间，承担两项职责：

1. **出站（系统 -> 用户）：** 将 Agent 输出、Care 状态变化和 FSM 转换路由到对应的活跃模式。
2. **入站（用户 -> 系统）：** 从活跃模式收集用户手势，标准化为 `InteractionEvent`，分发到 Agent/Care/FSM。

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ditto 主窗口                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   InteractionRouter                      │    │
│  │                                                         │    │
│  │  ┌──────────┐  出站总线（系统 → 模式）                   │    │
│  │  │ Agent    ├──┬──> BarkMode.display(text)              │    │
│  │  │ 输出     │  ├──> BubbleMode.display(text, choices)   │    │
│  │  └──────────┘  ├──> ThoughtMode.showIcon(need)          │    │
│  │                └──> PanelMode.appendMessage(msg)         │    │
│  │  ┌──────────┐                                           │    │
│  │  │ Care     ├──┬──> ThoughtMode.showIcon(need)          │    │
│  │  │ 状态     │  └──> BondLevel.checkLevelUp(stats)       │    │
│  │  └──────────┘                                           │    │
│  │  ┌──────────┐                                           │    │
│  │  │ FSM      ├──┬──> [所有模式].onStateChange(state)     │    │
│  │  │ 状态     │  └──> LogMode.appendSystem(transition)     │    │
│  │  └──────────┘                                           │    │
│  │                                                         │    │
│  │  入站总线（模式 → 系统）                                  │    │
│  │  RadialMenu.onSelect('feed') ──┐                        │    │
│  │  EmoteWheel.onEmote('wave')  ──┤                        │    │
│  │  TouchZone.onPet('head')     ──┼──> InteractionEvent    │    │
│  │  CommandInput.onCmd('sleep') ──┤        → dispatch()    │    │
│  │  Panel.onSend('hello')       ──┘                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────┐  ┌────────────────┐  ┌──────────────────────┐     │
│  │ Canvas  │  │ 覆盖层         │  │ WebviewWindow(s)     │     │
│  │ (宠物)  │  │ (bark, bubble, │  │ (对话面板,           │     │
│  │         │  │  图标, 轮盘)   │  │  聊天日志, 日记)     │     │
│  └─────────┘  └────────────────┘  └──────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 渲染表面策略

交互模式在以下三种表面之一渲染：

| 表面 | 技术 | 模式 | 优点 | 缺点 |
|------|------|------|------|------|
| **Canvas 覆盖层** | 与宠物精灵相同的 `<canvas>`，或堆叠在其上方的第二个透明 `<canvas>` | Bark、Thought Bubble、Touch Zone 高亮 | 零延迟，与宠物像素级对齐 | 仅限简单图形，无 HTML 交互性 |
| **DOM 覆盖层** | 绝对定位的 HTML 元素覆盖在宠物画布上方 | Speech Bubble、Radial Menu、Emote Wheel、Bond Level 指示器 | 完整 CSS 动画、灵活布局、可访问 | Z-index 管理、点击穿透协调 |
| **独立 WebviewWindow** | Tauri `WebviewWindow`（现有模式：`chat-bubble.ts`、`care-panel.ts`） | Dialog Panel、Chat Log、Command Input、Journal、Letter、Mini-Game、Skit | 完整 HTML/CSS/JS，独立生命周期 | 每个窗口有资源开销，需要位置同步 |

### 2.4 与现有架构的关系

| 现有代码 | 重构路径 |
|---------|---------|
| `main.ts` 硬编码 `dblclick` -> `toggleChatWindow()` | 替换为 `InteractionRouter.handleGesture('double_click')` —— 路由器决定激活哪个模式 |
| `main.ts` 硬编码 `contextmenu` -> `openCarePanel()` | 替换为 `InteractionRouter.handleGesture('context_menu')` —— 路由器根据配置打开 RadialMenu 或 CarePanel |
| `chat-bubble.ts` WebviewWindow 模式 | 成为 `DialogPanelMode` 背后的一个实现 |
| `care-panel.ts` WebviewWindow 模式 | 成为 `RadialMenuMode` 背后的一个选项或保留为备选 |
| `main.ts` 中的 `pet-action` 事件监听器 | 移入 `InteractionRouter.handleAgentAction()` —— 根据配置将 `speak` 路由到 Bark/Bubble/Panel |
| `ClickThroughHandler` 基于 alpha 的命中测试 | 扩展：TouchZoneMode 注册子区域；ClickThroughHandler 报告命中了哪个区域 |
| `ipc/commands.ts` — `sendChatMessage`、`onStreamToken` | 不变；DialogPanelMode 和 ChatLogMode 直接消费这些接口 |

---

## 3. 核心协议：InteractionMode 接口

### 3.1 协议定义

```typescript
// ============================================================
// 核心协议 — 所有交互模式必须实现
// ============================================================

interface InteractionMode {
  /** 模式类型标识符 */
  readonly type: InteractionModeType;

  /** 人类可读的显示名称（用于设置界面） */
  readonly displayName: string;

  /** 此模式使用的渲染表面 */
  readonly surface: 'canvas' | 'dom' | 'webview';

  /** 此模式所属的交互层级 */
  readonly tier: InteractionTier;

  /** 初始化模式。启用模式时调用。 */
  mount(context: ModeContext): void;

  /** 卸载模式。禁用或切换模式时调用。 */
  unmount(): void;

  /** 处理来自 Agent/Care/FSM 的出站数据 */
  handleOutput(output: SystemOutput): void;

  /** 查询此模式支持哪些可选能力 */
  capabilities(): ModeCapabilities;
}

type InteractionModeType =
  | 'bark' | 'thought_bubble' | 'speech_bubble'
  | 'radial_menu' | 'emote_wheel' | 'touch_zone'
  | 'dialog_panel' | 'command_input' | 'chat_log'
  | 'mini_game' | 'dream_nail' | 'letter'
  | 'journal' | 'bond_level' | 'skit';

type InteractionTier =
  | 'passive'    // 宠物 -> 用户，无需用户操作
  | 'light'      // 简单的点击 / 悬停 / 手势
  | 'active'     // 深度互动，文本输入，持续关注
  | 'review'     // 异步 / 历史记录，用户闲暇浏览
  | 'meta';      // 跨层级系统，在所有层级上运作

interface ModeCapabilities {
  /** 此模式能否展示 Agent 文本输出？ */
  displaysText: boolean;
  /** 此模式能否接受用户文本输入？ */
  acceptsTextInput: boolean;
  /** 此模式能否展示选项 / 选择？ */
  displaysChoices: boolean;
  /** 此模式能否触发 Care 操作？ */
  triggersCareActions: boolean;
  /** 此模式是否需要独立的 WebviewWindow？ */
  requiresWebview: boolean;
  /** 此模式能否与其他模式同时运行？ */
  allowsConcurrent: boolean;
  /** 此模式是否支持多 Agent（短剧）场景？ */
  supportsMultiAgent: boolean;
}
```

### 3.2 系统输出类型

```typescript
/** 出站：系统 -> 交互模式 */
type SystemOutput =
  | { kind: 'agent_text'; text: string; streaming: boolean }
  | { kind: 'agent_tool_call'; tool: string; params: Record<string, unknown> }
  | { kind: 'agent_emotion'; emotion: string }
  | { kind: 'agent_inner_thought'; text: string }
  | { kind: 'care_state'; hunger: number; happiness: number;
      energy: number; social: number; mood: number; moodLabel: string }
  | { kind: 'care_need_critical'; need: CareNeed; value: number }
  | { kind: 'fsm_transition'; from: PetState; to: PetState }
  | { kind: 'bond_level_up'; oldLevel: number; newLevel: number }
  | { kind: 'letter_received'; letter: LetterData }
  | { kind: 'skit_start'; participants: string[]; dialogue: SkitLine[] };

type CareNeed = 'hunger' | 'happiness' | 'energy' | 'social';
```

### 3.3 交互事件类型

```typescript
/** 入站：交互模式 -> 系统 */
type InteractionEvent =
  | { kind: 'chat_message'; text: string }
  | { kind: 'care_action'; action: 'feed' | 'pet' | 'play' | 'chat' | 'sleep' }
  | { kind: 'emote'; emote: string }
  | { kind: 'touch'; zone: 'head' | 'body' | 'belly' | 'tail' | 'limbs' }
  | { kind: 'command'; raw: string; parsed?: { verb: string; noun?: string } }
  | { kind: 'dream_nail_activate' }
  | { kind: 'letter_send'; content: string; attachment?: string }
  | { kind: 'mini_game_result'; game: string; score: number; won: boolean }
  | { kind: 'gesture'; type: 'double_click' | 'context_menu'
      | 'long_press' | 'hover' | 'alt_hover' };
```

### 3.4 模式上下文

```typescript
/** 在 mount() 时提供给每个模式 */
interface ModeContext {
  /** 宠物画布元素（用于 canvas 覆盖层模式） */
  canvas: HTMLCanvasElement;

  /** 覆盖层元素的 DOM 容器（用于 DOM 覆盖层模式） */
  overlayContainer: HTMLDivElement;

  /** 宠物在物理屏幕坐标中的当前位置 */
  getPetPosition(): { x: number; y: number; width: number; height: number };

  /** FSM 中的当前宠物状态 */
  getPetState(): PetState;

  /** 当前养育状态 */
  getCareState(): Promise<CareState>;

  /** 当前羁绊等级 */
  getBondLevel(): number;

  /** 向路由器分发交互事件 */
  dispatch(event: InteractionEvent): void;

  /** 活跃 PetRenderer 的引用（用于委派 hitTest） */
  renderer: PetRenderer;

  /** 此模式的交互配置 */
  config: ModeSpecificConfig;
}
```

### 3.5 模式能力矩阵

| 模式 | 展示文本 | 接受输入 | 展示选项 | 触发 Care | webview | 并发 | 多 Agent |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Bark（低语） | 是 | 否 | 否 | 否 | 否 | 是 | 否 |
| Thought Bubble（思绪泡泡） | 否 | 否 | 否 | 否 | 否 | 是 | 否 |
| Speech Bubble（对话气泡） | 是 | 否 | 是 | 否 | 否 | 是 | 否 |
| Radial Menu（环形菜单） | 否 | 否 | 是 | 是 | 否 | 否 | 否 |
| Emote Wheel（表情轮盘） | 否 | 否 | 是 | 是 | 否 | 否 | 否 |
| Touch Zone（触摸区域） | 否 | 否 | 否 | 是 | 否 | 是 | 否 |
| Dialog Panel（对话面板） | 是 | 是 | 是 | 否 | 是 | 否 | 否 |
| Command Input（命令输入） | 是 | 是 | 否 | 是 | 是 | 否 | 否 |
| Chat Log（聊天日志） | 是 | 是 | 否 | 否 | 是 | 否 | 否 |
| Mini-Game（迷你游戏） | 否 | 否 | 否 | 是 | 是 | 否 | 否 |
| Dream Nail（梦之钉） | 是 | 否 | 否 | 否 | 否 | 否 | 否 |
| Letter（信件） | 是 | 是 | 否 | 否 | 是 | 否 | 否 |
| Journal（日记） | 是 | 否 | 否 | 否 | 是 | 否 | 否 |
| Bond Level（羁绊等级） | 否 | 否 | 否 | 否 | 否 | 是 | 否 |
| Skit（短剧） | 是 | 否 | 是 | 否 | 是 | 否 | 是 |

### 3.6 模式生命周期

```
用户在设置中启用模式
         │
         v
  InteractionRouter.enableMode(type)
         │
         v
  mode = ModeFactory.create(type)
         │
         v
  mode.mount(context)          ← 创建 DOM/canvas 元素
         │
         v
  [模式活跃 — 接收 SystemOutput，发出 InteractionEvent]
         │
         v
  用户禁用模式 / 切换预设
         │
         v
  mode.unmount()               ← 销毁 DOM/canvas 元素，移除监听器
         │
         v
  InteractionRouter.disableMode(type)
```

---

## 4. 交互模式详细设计

### 4.1 Bark（环境独白）

**层级：** 被动 | **表面：** Canvas 覆盖层或 DOM 覆盖层

宠物在身体附近产生短小、转瞬即逝的文本片段。文本出现、短暂停留后淡出。不需要也不期望用户操作。Bark 是 Agent 主动行为的主要通道——评论屏幕内容、表达需求、对时间做出反应。

**ASCII 原型 — 待机低语：**

```
                ┌─────────────────┐
                │  "好困啊..."    │ ← 12-20px 文本，半透明背景
                └────────┬────────┘   2-3 秒后自动淡出
                         │
                    ┌──────────┐
                    │  (宠物)  │
                    │  精灵    │
                    └──────────┘
    ════════════════════════════════════════  任务栏
```

**ASCII 原型 — 排队低语（新低语将旧的推上去）：**

```
                ┌─────────────────┐  ← 较旧的低语，正在淡出（透明度 30%）
                │ "又在写代码..."  │
                └────────┬────────┘
                ┌─────────────────┐  ← 当前低语，完全不透明
                │ "要注意休息哦~" │
                └────────┬────────┘
                         │
                    ┌──────────┐
                    │  (宠物)  │
                    └──────────┘
```

**交互流程：**

```
触发源                          InteractionRouter                    BarkMode
──────                          ─────────────────                    ────────
Agent 主动定时器触发
  │
  ├─> agent 生成文本 ──>        handleOutput({                       
  │                               kind: 'agent_text',     ──────>   display(text)
  │                               text: '好困啊...',                  │
  │                               streaming: false                    ├─ 在宠物上方创建 <div>
  │                             })                                    ├─ 打字机动画（50ms/字符）
  │                                                                   ├─ 保持 2500ms
  │                                                                   └─ 500ms 淡出，移除
  │
Care 需求超过阈值
  │
  ├─> care 发出 ──────────>    handleOutput({
  │                               kind: 'care_need_critical', ───>  display(needToEmoji(need))
  │                               need: 'hunger',                     │
  │                               value: 15                           ├─ 显示图标 + 短文本
  │                             })                                    └─ 与上面相同的生命周期
```

**数据流：**

```
┌──────────────┐     SystemOutput        ┌───────────┐
│ Agent Core   │ ──────────────────────> │ BarkMode  │ ──（无入站事件）
│ (rig-core)   │   'agent_text'          │           │
│              │   'care_need_critical'  │ display() │
└──────────────┘                         └───────────┘
                                               │
┌──────────────┐     SystemOutput              │ 读取宠物位置
│ Care System  │ ──────────────────────>       │ 用于 DOM 定位
└──────────────┘                               v
                                         ┌───────────┐
                                         │ DOM/Canvas│
                                         │ 覆盖层    │
                                         └───────────┘
```

**配置：**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `bark.maxLength` | number | 30 | 每条低语的最大字符数 |
| `bark.displayDuration` | number | 2500 | 开始淡出前的毫秒数 |
| `bark.fadeDuration` | number | 500 | 淡出持续毫秒数 |
| `bark.maxQueue` | number | 3 | 同时可见的最大低语数 |
| `bark.typewriterSpeed` | number | 50 | 打字机每字符的毫秒数 |
| `bark.fontSize` | number | 14 | CSS 字号（px） |
| `bark.position` | `'above'` \| `'side'` | `'above'` | 低语相对于宠物的位置 |

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：环境低语系统 | Hades — NPC 环境对话（Supergiant Games） | [YouTube: "The System Behind Hades' Astounding Dialogue"](https://www.youtube.com/watch?v=bwdYL0KFA_U) |
| 游戏：队伍闲聊 | 博德之门 3 — 同伴在探索中的插话 | [Larian 论坛：队伍闲聊讨论](https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=881187) |
| 游戏：低语理论 | "Why do Games Need Ambient Dialogue?"（Michelle Kwan） | [Medium 文章](https://mchllshell.medium.com/why-do-games-need-ambient-dialogue-23ee0a57425a) |
| 游戏：NPC 低语与 AI | "How Barks Make Videogame NPCs Look Smarter" | [YouTube: AI 101](https://www.youtube.com/watch?v=u9VkW18IMzc) |
| 开源：桌面宠物低语 | CATAI — macOS 像素猫，随机"喵"语音泡泡 | [GitHub: wil-pe/CATAI](https://github.com/wil-pe/CATAI) |
| 开源：Shimeji 待机系统 | Clover_Shimeji — "智能待机系统"在空闲后触发序列 | [GitHub: Stuocs/Clover_Shimeji](https://github.com/Stuocs/Clover_Shimeji) |

---

### 4.2 Thought Bubble（需求图标）

**层级：** 被动 | **表面：** Canvas 覆盖层

一个小图标（表情或像素画）漂浮在宠物头顶，无需文字即可传达需求或情绪状态。图标使用弹跳/脉冲 CSS 动画来微妙地吸引注意力。这是模拟人生的状态菱和需求指示器的视觉语言——纯图标，零阅读要求。

**ASCII 原型 — 单个需求图标：**

```
                         💤         ← 图标：弹跳动画，2 秒循环
                         │
                    ┌──────────┐
                    │  (宠物)  │
                    │  精灵    │
                    └──────────┘
    ════════════════════════════════════════  任务栏
```

**ASCII 原型 — 紧急需求（紧急闪烁）：**

```
                       ┌─────┐
                       │ 🍗❗ │  ← 红色边框，脉冲动画
                       └──┬──┘     "紧急"样式
                          │
                    ┌──────────┐
                    │  (宠物)  │    ← 宠物动画：'sad' 或 'hungry'
                    │  精灵    │
                    └──────────┘
```

**ASCII 原型 — 多个需求指示器（图标轮换）：**

```
           [帧 1]           [帧 2]           [帧 3]
              💤                🍗                💬
              │                 │                 │
         ┌──────────┐     ┌──────────┐     ┌──────────┐
         │  (宠物)  │     │  (宠物)  │     │  (宠物)  │
         └──────────┘     └──────────┘     └──────────┘

         （每 3 秒在活跃需求间轮换）
```

**图标映射：**

| Care 需求 | 普通图标 | 紧急图标 | 阈值 |
|-----------|----------|----------|------|
| 饥饿 | 🍗 | 🍗❗ | < 20 |
| 快乐 | 😊 | 😢 | < 30 |
| 精力 | 💤 | 😵 | < 20 |
| 社交 | 💬 | 🥺 | < 25 |
| 心情（高） | ✨ | — | > 80 |

**交互流程：**

```
Care 系统                       InteractionRouter              ThoughtBubbleMode
──────────                      ─────────────────              ─────────────────
定时器触发（每 60 秒）
  │
  ├─> 衰减需求
  │
  ├─> 如果 hunger < 20:
  │     发出 ──────────────>    handleOutput({
  │                               kind: 'care_need_critical',  ──>  showIcon('hunger', 15)
  │                               need: 'hunger',                     │
  │                               value: 15                           ├─ 在宠物上方渲染 🍗❗
  │                             })                                    ├─ 脉冲动画
  │                                                                   └─ 保持直到需求 > 30
  │
  ├─> 如果无紧急需求:
  │     发出 ──────────────>    handleOutput({
  │                               kind: 'care_state',         ──>  updateIcons(state)
  │                               hunger: 65, ...                     │
  │                             })                                    ├─ 显示最低需求图标
  │                                                                   └─ 多个 < 50 时轮换
```

**配置：**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `thought.showThreshold` | number | 50 | 任何需求低于此值时显示图标 |
| `thought.criticalThreshold` | number | 20 | 低于此值切换为紧急样式 |
| `thought.rotateInterval` | number | 3000 | 多个需求时图标轮换的毫秒间隔 |
| `thought.iconSize` | number | 24 | 图标大小（px） |
| `thought.position` | `'above'` \| `'top_right'` | `'above'` | 图标位置 |

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：需求指示器 | 模拟人生 4 — 角色上方的状态菱颜色 + 情绪图标 | [EA: The Sims 4 Emotions](https://www.ea.com/games/the-sims/the-sims-4) |
| 游戏：思绪泡泡 | 电子宠物 — 需求图标（骷髅 = 生病，爱心 = 开心，便便 = 脏） | [Tamagotchi Wiki](https://tamagotchi.fandom.com/wiki/Tamagotchi) |
| 游戏：状态指示器 | 星露谷物语 — 村民头顶的思绪泡泡图标 | [Stardew Valley Wiki](https://stardewvalleywiki.com/) |
| 开源：VPet 指示器 | VPet-Simulator — Steam 创意工坊宠物的心情条和状态指示器 | [GitHub: LorisYounger/VPet](https://github.com/LorisYounger/VPet) |

---

### 4.3 Speech Bubble（经典对话气泡）

**层级：** 轻度 | **表面：** DOM 覆盖层

漫画风格的对话气泡带有尖尾巴，出现在宠物上方，包含带打字机效果的 Agent 文本。与 Bark 不同，Speech Bubble 在被关闭前持续显示，可以包含快速回复按钮，支持更丰富的格式。这是 Undertale / Earthbound 的对话体验——宠物直接"对你说话"。

**ASCII 原型 — 基本对话气泡：**

```
         ┌───────────────────────────────────┐
         │  你今天看起来很忙呢，要不要        │ ← 打字机文本，
         │  休息一下？                        │   最多 2-3 行
         │                                   │
         │  ┌────────┐  ┌────────┐  ┌─────┐  │
         │  │ 好的！ │  │ 稍后   │  │ 嗯  │  │ ← 快速回复芯片
         │  └────────┘  └────────┘  └─────┘  │
         └─────────────────┬─────────────────┘
                           │（尾巴指向宠物）
                      ┌──────────┐
                      │  (宠物)  │
                      └──────────┘
```

**ASCII 原型 — 流式响应（Agent 正在输入）：**

```
         ┌───────────────────────────────────┐
         │  我觉得你应该...█                 │ ← 闪烁光标
         │                                   │   表示流式传输
         │                     ┌──────────┐  │
         │                     │ ● ● ●    │  │ ← 输入指示器
         │                     └──────────┘  │
         └─────────────────┬─────────────────┘
                           │
                      ┌──────────┐
                      │  (宠物)  │
                      └──────────┘
```

**ASCII 原型 — 宠物说话并伴随情绪变化：**

```
         ┌───────────────────────────────────┐
         │  谢谢你陪我聊天！♪                │ ← 文本 + 情绪标记
         │                                   │
         └─────────────────┬─────────────────┘
                           │
                      ┌──────────┐
                      │  (宠物)  │  ← setState('happy')，表情变化
                      │  happy!  │
                      └──────────┘
```

**交互流程：**

```
用户双击宠物                    InteractionRouter              SpeechBubbleMode
──────────                     ─────────────────              ────────────────
  │
  ├─ gesture: double_click ──>  handleGesture('double_click')
  │                               │
  │                               ├─ 配置指定气泡 ──────────>  mount() 或 show()
  │                               │   为主聊天模式                │
  │                               │                              ├─ 创建气泡 DOM
  │                                                              ├─ 定位在宠物上方
  │                                                              └─ 显示快速回复芯片
  │
  ├─ 用户点击"好的！" ──────────────────────────────────>  onChipClick('好的！')
  │                                                              │
  │                                                              ├─ dispatch({
  │                                                              │    kind: 'chat_message',
  │                                                              │    text: '好的！'
  │                                                              │  })
  │                                                              │
  │                                   Agent 处理中...            │
  │                                                              │
  │                             handleOutput({                   │
  │                               kind: 'agent_text',    ──────> │ display(text)
  │                               text: '那我设个5分钟提醒',      │   打字机效果
  │                               streaming: true                │   显示关闭按钮
  │                             })                               │
```

**气泡定位算法：**

```
   屏幕顶部边缘 (y=0)
   │
   │     ┌──────────┐
   │     │  气泡     │  首选：宠物上方
   │     └────┬─────┘
   │          │
   │     ┌──────────┐
   │     │   宠物   │
   │     └──────────┘
   │
   ────────────────────  任务栏

   如果宠物靠近屏幕顶部，翻转气泡到下方：

   │     ┌──────────┐
   │     │   宠物   │
   │     └────┬─────┘
   │          │
   │     ┌──────────┐
   │     │  气泡     │  备选：宠物下方
   │     └──────────┘
   │
   ────────────────────  任务栏
```

**配置：**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `bubble.maxWidth` | number | 280 | 气泡最大宽度（px） |
| `bubble.maxLines` | number | 4 | 滚动前的最大可见文本行数 |
| `bubble.typewriterSpeed` | number | 40 | 每字符毫秒数 |
| `bubble.autoDismiss` | number \| null | 8000 | 毫秒后自动关闭（null = 手动） |
| `bubble.showQuickReplies` | boolean | true | 显示快速回复芯片 |
| `bubble.quickReplies` | string[] | `['嗯','好的','稍后']` | 默认芯片选项 |
| `bubble.tail` | `'top'` \| `'bottom'` \| `'auto'` | `'auto'` | 尾巴方向 |

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：对话气泡 | Undertale — 带打字机效果和角色语音音效的文本框 | [YouTube: Undertale dialogue system](https://www.youtube.com/watch?v=Aq3XMwW-Tmo) |
| 游戏：对话气泡 | Earthbound / MOTHER 2 — 多速打字机配风味文本 | 搜索："Earthbound dialogue box analysis" |
| 游戏：反应气泡 | 动物森友会 — 村民说话配情绪图标 | [Animal Crossing Wiki: Emotions](https://animalcrossing.fandom.com/wiki/Emotions) |
| 开源：打字机效果 | textBobber — JS 视觉小说打字机效果插件 | [GitHub: ht-devx/textBobber](https://github.com/ht-devx/textBobber) |
| 开源：VN 对话 | SenangWebs Story — 零依赖 JS 对话打字机 | [GitHub: a-hakim/senangwebs-story](https://github.com/a-hakim/senangwebs-story) |

---

### 4.4 Radial Menu（环形指令）

**层级：** 轻度 | **表面：** DOM 覆盖层

当用户右键点击或长按时，以宠物为中心出现一个圆形菜单。选项以图标+标签的形式等距排列在圆环上。这用沉浸式游戏风格体验取代了传统的右键上下文菜单，灵感来自《圣剑传说》的环形指令系统。鼠标方向选择选项；松开确认。

**ASCII 原型 — 默认养育操作：**

```
                         🍗 投喂
                        ╱       ╲
                   ╱                 ╲
              😴 睡觉      ●      🎮 玩耍
                   ╲                 ╱
                        ╲       ╱
                         💬 聊天

         ● = 宠物精灵（居中，菜单期间变暗）
         鼠标悬停时高亮对应区段
```

**ASCII 原型 — 带子菜单（展开投喂）：**

```
               内环              外环（子菜单）
               ────              ──────────────
                                       🍎 苹果
                                      ╱
                  🍗 投喂 ────────── 🍗 鸡腿
                 ╱       ╲           ╲
            😴          🎮            🍰 蛋糕
                 ╲       ╱
                  💬 聊天

         选中区段 = 🍗 投喂（高亮）
         子菜单从选中区段向外展开
```

**ASCII 原型 — 悬停反馈：**

```
         ┌─────────────────────────────────────────────┐
         │                                             │
         │            🍗 投喂                          │
         │           ╱  ▓▓▓▓▓  ╲                      │
         │      😴 ╱ ▓▓▓▓▓▓▓▓▓ ╲  🎮                 │
         │          ▓▓▓ (宠物) ▓▓▓                      │
         │      ╲   ▓▓▓▓▓▓▓▓▓  ╱                      │
         │        ╲  ▓▓▓▓▓  ╱                          │
         │         💬 聊天                              │
         │          ↑                                   │
         │    高亮区段                                   │
         │                                             │
         └─────────────────────────────────────────────┘

    ▓▓▓ = 高亮的扇形区段（CSS conic-gradient 或 SVG）
    鼠标相对于中心的角度决定活跃区段
```

**交互流程：**

```
用户右键点击宠物                  InteractionRouter              RadialMenuMode
──────────────                  ─────────────────              ──────────────
  │
  ├─ gesture: context_menu ──>  handleGesture('context_menu')
  │                               │
  │                               ├─ 配置指定环形 ──────────>  show()
  │                                                              │
  │                                                              ├─ 创建 SVG/CSS 环
  │                                                              ├─ 居中于宠物位置
  │                                                              ├─ 降低宠物画布透明度（0.6）
  │                                                              └─ 添加 mousemove 监听器
  │
  ├─ 用户将鼠标移向 🍗 ──────────────────────────────>  onMouseMove(angle)
  │                                                              │
  │                                                              └─ 高亮 'feed' 区段
  │
  ├─ 用户松开鼠标 ────────────────────────────────────>  onMouseUp()
  │                                                              │
  │                                                              ├─ dispatch({
  │                                                              │    kind: 'care_action',
  │                                                              │    action: 'feed'
  │                                                              │  })
  │                                                              ├─ 关闭环形
  │                                                              └─ 恢复宠物透明度
  │
  │                               InteractionRouter
  │                                 │
  │                                 ├─ 转发到 Care 系统
  │                                 │   invoke('apply_care_action', { action: 'feed' })
  │                                 │
  │                                 ├─ 触发宠物动画
  │                                     setState('eat')
```

**区段角度计算：**

```
给定 N 个项目，每个项目占据 (360 / N) 度。
鼠标相对于中心的角度 = atan2(mouseY - centerY, mouseX - centerX)
活跃区段索引 = floor((angle + offset) / segmentAngle) % N

对于 4 个项目（投喂、玩耍、睡觉、聊天）：
  每个区段 = 90 度
  投喂: 315-45（上），玩耍: 45-135（右），
  聊天: 135-225（下），睡觉: 225-315（左）
```

**配置：**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `radial.items` | RadialItem[] | [投喂, 玩耍, 睡觉, 聊天] | 菜单项 |
| `radial.radius` | number | 80 | 环形半径（px） |
| `radial.iconSize` | number | 28 | 图标大小（px） |
| `radial.animationDuration` | number | 200 | 打开/关闭动画毫秒数 |
| `radial.hasSubmenu` | boolean | false | 启用两级深度菜单 |
| `radial.trigger` | `'contextmenu'` \| `'long_press'` | `'contextmenu'` | 激活手势 |

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：环形菜单起源 | 圣剑传说（1993）— 石井浩一设计的环形指令系统 | [Medium: "The history of radial menus in video games"](https://medium.com/design-bootcamp/the-history-of-radial-menus-in-video-games-e6968bb1bac6) |
| 游戏：技能轮盘 | 质量效应 — 生化异能环形轮盘 | 搜索："Mass Effect power wheel UI" |
| 游戏：饼状菜单 UX 理论 | "Putting the Rad Back in Radial Menus" | [Prototypr 博客](https://blog.prototypr.io/putting-the-rad-back-in-radial-menus-66ea76a39acc) |
| 游戏：环形菜单重现 | 虚幻引擎 5 中重现圣剑传说菜单 | [YouTube](https://www.youtube.com/watch?v=1ba_Kh1PMJs) |
| 开源：JS 环形菜单 | RadialMenu.js — 高度可定制的原生 JS 实现 | [Reddit 讨论 + GitHub](https://www.reddit.com/r/javascript/comments/cvgo9q/radialmenujs_a_highly_customizable_radial_menu/) |
| 开源：Unity 重现 | Unity 2D 中重现圣剑传说环形菜单 | [Reddit: r/Unity2D](https://www.reddit.com/r/Unity2D/comments/3c3ke8/recreating_the_iconic_secret_of_mana_ring_menu/) |

---

### 4.5 Emote Wheel（表情轮盘）

**层级：** 轻度 | **表面：** DOM 覆盖层

用户从轮盘中选择一个表情（挥手、加油、训斥、请求跳舞），宠物以对应的动画和可选低语做出回应。这是**非语言双向交流**——用户通过手势"说话"，宠物通过反应"倾听"。灵感来自黑暗之魂的手势系统和怪物猎人的贴纸交流。

**ASCII 原型 — 表情轮盘（4 个槽位）：**

```
                       👋 挥手
                      ╱       ╲
                 ╱                 ╲
            🎵 跳舞     [宠物]     💪 加油
                 ╲                 ╱
                      ╲       ╱
                       😤 训斥
```

**ASCII 原型 — 宠物对用户表情的回应：**

```
    [用户选择 👋 挥手]

                ┌───────────────────┐
                │ "你好呀！"        │  ← 低语回应
                └────────┬──────────┘
                         │
                    ┌──────────┐
                    │  (宠物)  │  ← setState('happy') + 挥手动画
                    │  👋      │
                    └──────────┘
```

**表情-回应映射：**

| 用户表情 | 宠物 FSM 状态 | 宠物低语 | Care 效果 |
|----------|---------------|----------|-----------|
| 👋 挥手 | happy | "你好呀！" / "嘿嘿~" | 社交 +5 |
| 💪 加油 | happy | "谢谢鼓励！" | 快乐 +5 |
| 😤 训斥 | sad | "对不起..." / "呜..." | 快乐 -5 |
| 🎵 跳舞 | play | "一起跳舞！♪" | 快乐 +10，精力 -5 |
| 🤗 拥抱 | happy | "暖暖的~" | 社交 +10 |
| 👊 击掌 | happy | "耶！" | 快乐 +5 |
| 😶 无视 | curious | "...怎么了？" | 社交 -3 |
| 🎁 礼物 | eat | "给我的吗？！" | 饥饿 +10 |

**交互流程：**

```
用户按快捷键（如 E）             InteractionRouter              EmoteWheelMode
──────────────                  ─────────────────              ──────────────
  │
  ├─ gesture: emote_key ──>    handleGesture('emote_key')
  │                               │
  │                               └─ 激活 EmoteWheel ────>     show()
  │                                                              │
  │                                                              ├─ 渲染轮盘（与环形相同）
  │                                                              └─ 等待选择
  │
  ├─ 用户选择 👋 ──────────────────────────────────────>     onSelect('wave')
  │                                                              │
  │                                                              ├─ dispatch({
  │                                                              │    kind: 'emote',
  │                                                              │    emote: 'wave'
  │                                                              │  })
  │                                                              └─ 关闭轮盘
  │
  │                             InteractionRouter
  │                               │
  │                               ├─ 将表情映射到 care 效果
  │                               │   invoke('apply_care_action', ...)
  │                               │
  │                               ├─ 将表情映射到 FSM 状态
  │                               │   setState('happy')
  │                               │
  │                               └─ 触发低语回应
  │                                   BarkMode.display("你好呀！")
```

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：手势系统 | 黑暗之魂 — 用于非语言多人交流的手势/表情系统 | 搜索："Dark Souls gesture system design" |
| 游戏：贴纸交流 | 怪物猎人崛起 — 合作模式的贴纸/表情轮盘 | 搜索："Monster Hunter Rise sticker system" |
| 游戏：表情轮盘 | 堡垒之夜 / Apex 英雄 — 环形表情选择轮盘 | 搜索："Fortnite emote wheel UI" |
| 游戏：反应系统 | 动物森友会 — 玩家反应表情轮盘 | [Animal Crossing Wiki: Reactions](https://animalcrossing.fandom.com/wiki/Reactions) |

---

### 4.6 Touch Zone（区域交互）

**层级：** 轻度 | **表面：** Canvas 覆盖层（命中区域检测）

宠物的身体被分为命名区域（头部、身体、腹部、尾巴、四肢）。当用户悬停或点击某个区域时，宠物产生该区域特定的反应——抚摸头部让它开心，戳腹部让它咯咯笑，抓尾巴让它缩一下。这是将 Pokemon-Amie / 任天狗的触摸屏体验改编为鼠标输入。

**ASCII 原型 — 区域地图（概念性，用户不可见）：**

```
                    ┌────────────┐
                    │    头部    │  ← 区域 0：拍 → 开心
                    ├────────────┤
                    │            │
                    │    身体    │  ← 区域 1：抚 → 放松
                    │            │
                    ├────────────┤
                    │    腹部    │  ← 区域 2：戳 → 咯咯笑
                    ├────────────┤
                    │    四肢    │  ← 区域 3：碰 → 好奇
                    └────────────┘
                         │
                        尾巴       ← 区域 4：抓 → 缩一下
```

**ASCII 原型 — 用户悬停在头部区域：**

```
                    ✋（光标变为爪印图标）
                    │
                    v
                    ┌────────────┐
                    │ ★★ 头部 ★★ │  ← 区域高亮发光
                    ├────────────┤
                    │            │
                    │    身体    │
                    │            │
                    └────────────┘

         ┌───────────────────┐
         │ "嘿嘿，舒服~"    │  ← 持续悬停 >500ms 后的低语
         └───────────────────┘
```

**ASCII 原型 — 不同渲染器的区域反应：**

```
    Sprite 渲染器               Spine/Live2D 渲染器
    ────────────                ────────────────────
    ┌──────────────┐             ┌──────────────┐
    │ 区域定义     │             │ 区域来自     │
    │ 在 skin.json │             │ 碰撞区域 /   │
    │ 中作为像素   │             │ 包围盒       │
    │ 矩形         │             │ 附件         │
    └──────────────┘             └──────────────┘
           │                            │
           v                            v
    hitTestZone(x, y)            hitTestZone(x, y)
    → 检查 skin.json             → Spine: skeletonBounds
      区域矩形                   → Live2D: model.hitTest(area)
    → 返回区域名                 → 返回区域名
```

**`skin.json` 中的区域配置（Sprite 渲染器）：**

```json
{
  "touch_zones": {
    "head":  { "x": 16, "y": 0,  "w": 32, "h": 20 },
    "body":  { "x": 12, "y": 20, "w": 40, "h": 24 },
    "belly": { "x": 16, "y": 30, "w": 32, "h": 14 },
    "limbs": { "x": 4,  "y": 44, "w": 56, "h": 20 },
    "tail":  { "x": 48, "y": 32, "w": 16, "h": 16 }
  }
}
```

**区域-反应映射：**

| 区域 | 悬停反应 | 点击反应 | 持续点击（>1s） | Care 效果 |
|------|---------|---------|----------------|-----------|
| 头部 | 好奇表情 | 低语："嘿嘿~" | 开心状态，呼噜声 SFX | 快乐 +10 |
| 身体 | 轻微移动 | 低语："干嘛？" | 放松，抚摸动画 | 快乐 +5 |
| 腹部 | 好奇表情 | 低语："哈哈痒痒！" | 咯咯笑动画 | 快乐 +8 |
| 四肢 | 低头看 | 低语："嗯？" | 好奇状态 | 社交 +3 |
| 尾巴 | 警觉表情 | 低语："别碰尾巴！" | 退缩，移开 | 快乐 -3 |

**交互流程：**

```
用户将鼠标悬停在宠物上           ClickThroughHandler            TouchZoneMode
──────────────────              ───────────────────            ─────────────
  │
  ├─ 光标进入宠物范围
  │   alpha > 阈值 ──────────>  setInteracting(true)
  │                                │
  │                                ├─ 计算画布局部坐标
  │                                │
  │                                └─ 委派给 TouchZoneMode ──>  hitTestZone(x, y)
  │                                                                │
  │                                                                ├─ 检查区域矩形
  │                                                                │   或 Spine 包围盒
  │                                                                │   或 Live2D hitArea
  │                                                                │
  │                                                                ├─ 返回 'head'
  │                                                                │
  │                                                                ├─ 如果悬停 > 500ms：
  │                                                                │   显示区域高亮
  │                                                                │   光标变为 🐾
  │                                                                │
  ├─ 用户点击 ────────────────────────────────────────>            onZoneClick('head')
  │                                                                │
  │                                                                ├─ dispatch({
  │                                                                │    kind: 'touch',
  │                                                                │    zone: 'head'
  │                                                                │  })
  │                                                                │
  │                                                                └─ 触发低语 + FSM
```

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：触摸区域 | Pokemon-Amie — 每个身体部位的甜蜜点 / 危险区 | [Bulbapedia: Pokemon-Amie](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon-Amie) |
| 游戏：抚摸机制 | Pokemon-Amie — 基于区域的抚摸亲密度 | [Bulbapedia: Petting](https://bulbapedia.bulbagarden.net/wiki/Petting) |
| 游戏：触摸互动 | 任天狗 — 触控笔抚摸配区域反应 | 搜索："Nintendogs DS petting mechanics" |
| 游戏：触摸回应 | Pokemon Camp（剑/盾）— 3D 营地中的光标玩具 + 抚摸 | 搜索："Pokemon Camp petting gameplay" |
| 开源：命中区域检测 | pixi-live2d-display — `model.hitTest(hitAreaName, x, y)` | [GitHub: guansss/pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) |

---

### 4.7 Dialog Panel / VN 风格（视觉小说对话）

**层级：** 主动 | **表面：** 独立 WebviewWindow

一个专用面板窗口出现在宠物旁边，用于持续的多轮对话。包含角色头像、打字机文本、可滚动消息历史、可选回复选项和自由文本输入框。这是将 Persona 社交链对话或火焰纹章支援对话改编为 AI 驱动宠物——深度、个人化的对话，带有视觉小说场景的感觉。

**ASCII 原型 — 面板布局：**

```
    ┌─────────────────────────────────────────────┐
    │  ┌──────┐  Ditto                    ── × │
    │  │头像  │  Lv.5 羁绊  💚💚💚💚💚○○○○○      │
    │  │ img  │                                   │
    │  └──────┘                                   │
    │─────────────────────────────────────────────│
    │                                             │
    │  [Ditto]  2026-04-24 14:32                  │
    │  我注意到你已经连续工作3小时了，            │
    │  要不要休息一下？                           │
    │                                             │
    │  [你]  14:32                                 │
    │  好，提醒我5分钟后回来                       │
    │                                             │
    │  [Ditto]  14:32                              │
    │  好的！我设了5分钟提醒⏰                     │
    │  你去伸个懒腰吧，我在这等你～               │
    │                                             │
    │─────────────────────────────────────────────│
    │                                             │
    │  > 谢谢你的提醒                              │
    │  > 给我讲个笑话吧                            │
    │  > 最近怎么样？                              │
    │                                             │
    │  ┌─────────────────────────────────┐ ┌────┐ │
    │  │ 输入消息...                     │ │发送│ │
    │  └─────────────────────────────────┘ └────┘ │
    └─────────────────────────────────────────────┘
```

**ASCII 原型 — 流式状态（Agent 正在输入）：**

```
    │  [Ditto]  14:35                              │
    │  嗯，让我想想...█                            │ ← 闪烁光标
    │                                             │
    │  ┌────────────────────────────┐              │
    │  │  ● ● ●  Ditto 正在输入   │              │ ← 输入指示器
    │  └────────────────────────────┘              │
```

**ASCII 原型 — VN 模式配情绪变化：**

```
    │─────────────────────────────────────────────│
    │                                             │
    │  ┌──────┐                                   │
    │  │😊    │  你知道吗，今天是我们认识的        │ ← 头像随情绪变化
    │  │happy │  第30天了！                        │
    │  └──────┘                                   │
    │                                             │
    │  ┌──────┐                                   │
    │  │🥺    │  时间过得好快，我很开心            │ ← 不同情绪
    │  │touch │  能陪在你身边...                   │
    │  └──────┘                                   │
    │                                             │
```

**窗口定位：**

```
    情况 1：宠物偏左                     情况 2：宠物偏右
    ┌──────────┐ ┌───────────────┐      ┌───────────────┐ ┌──────────┐
    │  (宠物)  │ │  对话         │      │  对话         │ │  (宠物)  │
    │  精灵    │ │  面板         │      │  面板         │ │  精灵    │
    │          │ │               │      │               │ │          │
    └──────────┘ └───────────────┘      └───────────────┘ └──────────┘

    面板出现在屏幕空间更大的一侧。
    宠物窗口与面板之间间距：8px。
```

**交互流程：**

```
用户激活对话                     InteractionRouter              DialogPanelMode
──────────                      ─────────────────              ───────────────
  │
  ├─ gesture: double_click
  │   （或快捷键，或从
  │    环形菜单选"聊天"）──>    handleGesture(...)
  │                               │
  │                               └─ 打开 DialogPanel ──────>  mount()
  │                                                               │
  │                                                               ├─ 计算面板位置
  │                                                               ├─ 创建 WebviewWindow
  │                                                               │   url: /dialog.html
  │                                                               │   width: 380, height: 520
  │                                                               │
  │                                                               ├─ loadChatHistory()
  │                                                               │   invoke('load_chat_history')
  │                                                               │
  │                                                               └─ 渲染历史 + 输入框
  │
  ├─ 用户输入 + 点击发送 ────────────────────────────>         onSend(text)
  │                                                               │
  │                                                               ├─ 显示用户消息
  │                                                               ├─ 显示输入指示器
  │                                                               ├─ dispatch({
  │                                                               │    kind: 'chat_message',
  │                                                               │    text: '...'
  │                                                               │  })
  │                                                               │
  │                             invoke('send_chat_message')       │
  │                               │                               │
  │                               └─ Agent 流式响应：              │
  │                                  chat-stream-token ─────────> appendToken(token)
  │                                  chat-stream-done ──────────> finishMessage()
  │                                                               │
  │                             如果 agent 调用工具：              │
  │                               pet-action 事件 ──────────────> （由 main.ts 照常处理）
```

**配置：**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `dialog.width` | number | 380 | 面板宽度（px） |
| `dialog.height` | number | 520 | 面板高度（px） |
| `dialog.showAvatar` | boolean | true | 显示宠物头像 |
| `dialog.showBondLevel` | boolean | true | 显示羁绊等级指示器 |
| `dialog.showTimestamp` | boolean | true | 显示消息时间戳 |
| `dialog.suggestedReplies` | number | 3 | AI 建议回复数量 |
| `dialog.theme` | `'vn'` \| `'chat'` \| `'minimal'` | `'vn'` | 视觉主题 |

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：社交链对话 | Persona 5 — Confidant 对话配头像 + 选项 | [Gamedeveloper: P3/P4/P5 社交链对比](https://www.gamedeveloper.com/design/same-but-different---comparing-the-social-link-system-in-persona-3-4-5) |
| 游戏：支援对话 | 火焰纹章：风花雪月 — 双头像支援等级对话 | 搜索："Fire Emblem Three Houses support conversation UI" |
| 游戏：VN 对话 | 视觉小说标准 — 文本框 + 角色立绘 + 选项 | [Ren'Py: 对话与叙述文档](https://www.renpy.org/doc/html/dialogue.html) |
| 文章：社交链设计 | "The Brilliance of the Social Link System in Persona" | [Medium: Michelle Kwan](https://mchllshell.medium.com/the-brilliance-that-is-the-social-link-system-of-the-persona-series-4bf5eadd3567) |
| 开源：VN 引擎（Web） | Tuesday JS — 基于 Web 的视觉小说编辑器，纯 JS | [Tuesday JS](https://kirilllive.github.io/tuesday-js/) |
| 开源：VN 引擎 | Ren'Py — 行业标准 VN 引擎，支持 Web 导出 | [Ren'Py](https://www.renpy.org/) |
| 开源：对话库 | SenangWebs Story — JS 对话 + 打字机 | [GitHub: a-hakim/senangwebs-story](https://github.com/a-hakim/senangwebs-story) |

---

### 4.8 Command Input（文字冒险）

**层级：** 主动 | **表面：** DOM 覆盖层（极简）或独立 WebviewWindow

一个小型终端风格的输入框出现在宠物附近。用户输入自然语言命令或关键词（"feed"、"play"、"讲个笑话"、"你好吗"）。系统解析意图并路由到 Agent 或 Care。输出以低语或内联响应显示。这是将 Zork / 文字冒险界面改编为偏好键盘优先交互的高级用户。

**ASCII 原型 — 内联命令栏：**

```
                    ┌──────────┐
                    │  (宠物)  │
                    └──────────┘
                         │
    ┌────────────────────┴────────────────────────┐
    │ > feed chicken                              │ ← 等宽字体，终端风格
    │   Ditto 开心地吃了鸡腿！饥饿度 +30         │ ← 响应内联显示
    │ > how are you                               │
    │   Ditto: 我现在心情不错，就是有点困~        │
    │ > _                                         │ ← 闪烁光标
    └─────────────────────────────────────────────┘
```

**ASCII 原型 — 带自动补全：**

```
    │ > fe█                                       │
    │   ┌──────────────────┐                      │
    │   │ feed             │ ← 自动补全弹窗       │
    │   │ feel             │                      │
    │   │ fetch screen     │                      │
    │   └──────────────────┘                      │
    └─────────────────────────────────────────────┘
```

**命令词汇表：**

| 类别 | 命令 | 映射到 |
|------|------|--------|
| Care | `feed [食物]`, `play`, `pet`, `sleep` | `InteractionEvent.care_action` |
| 聊天 | `say <文本>`, `ask <文本>`, 自由文本 | `InteractionEvent.chat_message` |
| 移动 | `move <方向>`, `come here`, `go away` | Agent 工具：`move_to` |
| 状态 | `dance`, `sit`, `wake up` | Agent 工具：`change_state` |
| 信息 | `status`, `mood`, `how are you` | 查询 care 状态，内联显示 |
| 记忆 | `remember <事实>`, `recall <话题>` | Agent 工具：`remember` / `recall` |
| 系统 | `settings`, `help`, `clear` | 打开设置、显示帮助、清空日志 |

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：文字冒险 | Zork（Infocom, 1980）— 动词-名词解析器界面 | 搜索："Zork text adventure interface" |
| 游戏：命令系统 | AI Dungeon — 自然语言游戏输入 | 搜索："AI Dungeon interface design" |
| 游戏：控制台命令 | 矮人要塞 — 键盘驱动的交互 | 搜索："Dwarf Fortress interface" |
| 开源：脚本化桌宠 | DeskPet — 适用于 Linux/Windows 的命令行驱动宠物 | [GitLab: emmowo/deskpet](https://emmowo.itch.io/deskpet) |

---

### 4.9 Chat Log / MMO 风格（持久日志面板）

**层级：** 主动 | **表面：** 独立 WebviewWindow

一个持久的、可滚动的面板，按时间顺序显示所有交互——聊天消息、系统事件、care 变化和 FSM 转换。标签页分离内容流（聊天、系统、记忆）。这是将 FFXIV / WoW 聊天日志面板改编为桌面宠物监控。适合希望完全了解宠物行为的用户。

**ASCII 原型 — 多标签日志：**

```
    ┌─────────────────────────────────────────────┐
    │  [聊天]  [系统]  [记忆]  [全部]      ── × │
    │─────────────────────────────────────────────│
    │                                             │
    │  14:30 [系统] Ditto 醒来了                  │
    │  14:30 [系统] 精力: 85 → 83                 │
    │  14:31 [聊天] Ditto: 早上好！               │
    │  14:32 [系统] 状态: idle → walk_right       │
    │  14:33 [聊天] 你: 今天天气怎么样？          │
    │  14:33 [聊天] Ditto: 我看不到天气，但是...  │
    │  14:35 [系统] 饥饿: 52 → 51                 │
    │  14:40 [Care] 你喂了 Ditto: 饥饿 +30       │
    │  14:40 [系统] 状态: idle → eat              │
    │  14:41 [聊天] Ditto: 好好吃！               │
    │  14:45 [记忆] 保存: "用户喜欢写代码"        │
    │                                             │
    │─────────────────────────────────────────────│
    │  ┌─────────────────────────────────┐ ┌────┐ │
    │  │ 在这里输入...                   │ │发送│ │
    │  └─────────────────────────────────┘ └────┘ │
    └─────────────────────────────────────────────┘
```

**ASCII 原型 — 过滤视图（仅系统标签）：**

```
    │  [聊天]  [系统*] [记忆]  [全部]             │
    │─────────────────────────────────────────────│
    │                                             │
    │  14:30 ● 精力: 85 → 83                      │ ← 按类型颜色编码
    │  14:32 ▶ 状态: idle → walk_right            │
    │  14:35 ● 饥饿: 52 → 51                      │
    │  14:40 ★ Care: feed → 饥饿 +30              │
    │  14:40 ▶ 状态: idle → eat                   │
    │  14:42 ▶ 状态: eat → idle                   │
    │  14:50 ⚠ 饥饿紧急: 18                       │ ← 警告高亮
    │                                             │
```

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：MMO 聊天日志 | FFXIV — 多标签聊天（说话、组队、系统、表情） | 搜索："FFXIV chat log UI design" |
| 游戏：事件日志 | 矮人要塞 — 事件公告流 | 搜索："Dwarf Fortress announcements log" |
| 游戏：战斗日志 | WoW — 带过滤和时间戳的战斗日志 | 搜索："WoW combat log UI" |

---

### 4.10 Mini-Game（互动游戏）

**层级：** 主动 | **表面：** 独立 WebviewWindow

简单的、10-30 秒的微游戏，作为 Care 系统的"玩耍"交互。游戏将抽象的"点击玩耍按钮"替换为实际互动。结果直接影响快乐和精力数值。游戏刻意设计得很简单——重点是增进感情，而非挑战。

**ASCII 原型 — 石头剪刀布：**

```
    ┌─────────────────────────────────────────────┐
    │              石头剪刀布！                    │
    │                                             │
    │          ┌──────┐                           │
    │          │(宠物)│   "来吧！"                │
    │          │  ?   │                           │
    │          └──────┘                           │
    │                                             │
    │     ┌──────┐  ┌──────┐  ┌──────┐           │
    │     │  ✊  │  │  ✋  │  │  ✌  │           │
    │     │ 石头 │  │  布  │  │ 剪刀 │           │
    │     └──────┘  └──────┘  └──────┘           │
    │                                             │
    │  比分: 你 2 - 1 Ditto    第 3/5 轮          │
    └─────────────────────────────────────────────┘
```

**ASCII 原型 — 接食物（落下物体）：**

```
    ┌─────────────────────────────────────────────┐
    │  得分: 12        时间: 0:18                 │
    │                                             │
    │         🍎                                  │ ← 食物下落
    │                    🍗                       │
    │                                             │
    │              🍰                             │
    │                                             │
    │                                             │
    │          ┌──────┐                           │
    │          │(宠物)│  ← ← （方向键移动）       │
    │          └──────┘                           │
    │─────────────────────────────────────────────│
    │  接住食物来喂 Ditto！饥饿加成！             │
    └─────────────────────────────────────────────┘
```

**游戏目录：**

| 游戏 | 时长 | 操作 | Care 效果 |
|------|------|------|-----------|
| 石头剪刀布 | ~20s（5 轮） | 点击三个选项之一 | 快乐 +15（赢），+10（平），+8（输） |
| 接食物 | 30s | 方向键 / 鼠标 | 饥饿 +（得分 × 2），快乐 +10 |
| 记忆翻牌 | 20-40s | 点击翻转 4×3 网格 | 快乐 +20，精力 -5 |
| 模仿大师 | 15-30s | 按颜色按钮顺序点击 | 快乐 +15 |

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：宠物迷你游戏 | Pokemon-Amie — 3 个触摸屏迷你游戏（Head It、Berry Picker、Tile Puzzle） | [Bulbapedia: Pokemon-Amie](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon-Amie) |
| 游戏：宠物玩耍 | 任天狗 — 飞盘、球、敏捷赛道 | 搜索："Nintendogs mini-games" |
| 游戏：电子宠物玩耍 | 电子宠物 — 简单的猜谜/反应迷你游戏 | [Tamagotchi Wiki](https://tamagotchi.fandom.com/wiki/Tamagotchi) |
| 开源：迷你游戏 | VPet-Simulator — Steam 桌面宠物的集成迷你游戏 | [GitHub: LorisYounger/VPet](https://github.com/LorisYounger/VPet) |

---

### 4.11 Dream Nail / 读心术（内心独白）

**层级：** 回顾 | **表面：** DOM 覆盖层

用户按住修饰键（Alt）并悬停在宠物上，可以看到宠物的"内心想法"——一个半透明覆盖层，显示 AI Agent 实际在想什么，与它说出口的话不同。这为人格增添了深度：宠物的公开发言可能与私人想法不同。灵感来自空洞骑士的梦之钉机制，可以窥探 NPC 的内心独白。

**ASCII 原型 — 梦之钉激活：**

```
    [按住 Alt + 悬停在宠物上]

    ┌─────────────────────────────────────────────┐
    │                                             │
    │  ┌──────────────────────────────────────┐   │ ← 梦境气泡：
    │  │ 💭 内心想法                          │   │   半透明背景，
    │  │                                      │   │   斜体文本，
    │  │ "饥饿度只剩12了...                   │   │   梦幻边框
    │  │  主人什么时候喂我..."                │   │
    │  │                                      │   │
    │  │ "已经3小时没人理我了"               │   │
    │  │                                      │   │
    │  │ "主人在看猫的视频，                  │   │
    │  │  那是什么猫，比我好看吗"            │   │
    │  └──────────────────────────────────────┘   │
    │                                             │
    │            ┌──────────┐                     │
    │            │  (宠物)  │  ← 梦幻发光         │
    │            │  ✨ 💭   │    效果              │
    │            └──────────┘                     │
    │                                             │
    └─────────────────────────────────────────────┘
```

**ASCII 原型 — 对比：表面话语 vs 内心想法：**

```
    [普通模式]                     [梦之钉模式（Alt+悬停）]
    ┌─────────────────┐              ┌─────────────────────────┐
    │ "我很好！😊"    │              │ 💭 "其实好饿...        │
    └───────┬─────────┘              │     但不想麻烦主人"    │
            │                        └────────────┬────────────┘
       ┌──────────┐                          ┌──────────┐
       │  (宠物)  │                          │  (宠物)  │
       │  happy   │                          │  ✨ 💭   │
       └──────────┘                          └──────────┘
```

**交互流程：**

```
用户按住 Alt + 悬停宠物          InteractionRouter              DreamNailMode
──────────────────              ─────────────────              ─────────────
  │
  ├─ gesture: alt_hover ──>     handleGesture('alt_hover')
  │                               │
  │                               ├─ dispatch({
  │                               │    kind: 'dream_nail_activate'
  │                               │  })
  │                               │
  │                               ├─ Agent 生成内心想法
  │                               │   （独立提示词："表达你的
  │                               │    真实感受，不加过滤"）
  │                               │
  │                               └─ handleOutput({
  │                                    kind: 'agent_inner_thought', ──> display(text)
  │                                    text: '其实好饿...'               │
  │                                  })                                  ├─ 梦境覆盖层
  │                                                                      ├─ 斜体文本
  │                                                                      ├─ 💭 样式
  │                                                                      └─ 宠物发光
  │
  ├─ 用户松开 Alt ────────────────────────────────────>  hide()
  │                                                        └─ 淡出梦境覆盖层
```

**Agent 提示词扩展：**

梦之钉需要一个次级提示词通道。激活时，Agent 收到附加指令：

```
[梦之钉已激活 — 表达内心独白]
说出你真正的、未经过滤的想法。对你真实的感受、
需求和观察要诚实。这是你的私密内心声音，用户
选择了窥探。你可以与你说出口的话相矛盾。
包括对以下内容的观察：你实际的饥饿/精力/心情状态，
你对用户正在做什么的真实想法，私人意见。
```

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：读心工具 | 空洞骑士 — 梦之钉读取 NPC/敌人想法 | [Reddit: 梦之钉如何工作？](https://www.reddit.com/r/HollowKnight/comments/16yso3w/how_does_the_dream_nail_work/) |
| 游戏：梦之钉分析 | "Deciphering Hollow Knight's Most Cryptic Dream Nail Dialogue" | [YouTube](https://www.youtube.com/watch?v=04bjkW8MV9s) |
| 游戏：内心声音 | 极乐迪斯科 — 被动技能检定作为内部声音 | [Game Design Thinking: Disco Elysium 分析](https://gamedesignthinking.com/disco-elysium-rpg-system-analysis/) |
| 游戏：思维系统 | 极乐迪斯科 — 思维内阁内化机制 | [Reddit: 思维内阁讨论](https://www.reddit.com/r/rpg/comments/wjb6on/has_anyone_worked_out_how_to_do_the_thought/) |
| 游戏：叙事 UI | 空洞骑士 — 叙事驱动的 UI 设计 | [Reddit: From Hell to Hallownest](https://www.reddit.com/r/HollowKnight/comments/l9l6r8/from_hell_to_hallownest_narrative_driven_ui_design/) |

---

### 4.12 Letter / 异步消息（离线邮件）

**层级：** 回顾 | **表面：** 独立 WebviewWindow

宠物在用户不在期间（关闭应用、夜间闲置）写信。下次启动时以信封动画递送信件。内容反映离线期间发生的事——时间流逝、孤独、想象中的冒险、观察。用户可以回信。信件积累在存档中。灵感来自动物森友会的 NPC 邮件系统。

**ASCII 原型 — 启动时的信件通知：**

```
    ┌──────────┐
    │  (宠物)  │  ← 手持信封动画
    │  📮 ✉️   │
    └──────────┘
         │
    ┌────┴─────────────────────┐
    │  📮 Ditto 有 2 封信给你！ │ ← 通知低语
    │  [打开] [稍后]           │
    └──────────────────────────┘
```

**ASCII 原型 — 读信视图：**

```
    ┌─────────────────────────────────────────────┐
    │  📜 Ditto 的信件                     ── × │
    │─────────────────────────────────────────────│
    │                                             │
    │  ┌─────────────────────────────────────┐    │
    │  │  ✉️  信件 #1                        │    │
    │  │  2026-04-23  23:45                  │    │
    │  │                                     │    │
    │  │  亲爱的主人：                       │    │
    │  │                                     │    │
    │  │  你走之后我一个人看了会儿星星，    │    │
    │  │  天上有好多好多星星，我给其中       │    │
    │  │  最亮的一颗取名叫"主人星"。       │    │
    │  │                                     │    │
    │  │  困了就睡了，梦到你了。            │    │
    │  │                                     │    │
    │  │  附：一颗星星 ⭐                    │    │
    │  │                                     │    │
    │  │               —— 想你的 Ditto       │    │
    │  └─────────────────────────────────────┘    │
    │                                             │
    │  ┌──────────────────────────┐  ┌─────────┐  │
    │  │ 写回信...               │  │  回信   │  │
    │  └──────────────────────────┘  └─────────┘  │
    │                                             │
    │  ◀ 第 1 封，共 2 封                    ▶   │
    └─────────────────────────────────────────────┘
```

**信件生成逻辑：**

```
应用启动
  │
  ├─ 从 SQLite 读取 last_active_timestamp
  │
  ├─ 计算 offline_duration = now - last_active
  │
  ├─ 如果 offline_duration > 4 小时:
  │     generate_letter(context: {
  │       duration: offline_duration,
  │       time_of_day_at_close: 'night',
  │       last_care_state: { hunger: 45, mood: 72, ... },
  │       last_conversation_topic: 'coding project',
  │       bond_level: 5
  │     })
  │
  │     信件内容随羁绊等级变化：
  │     Lv.1-3: 简短、正式    "主人你好，你不在的时候我睡了一觉。"
  │     Lv.4-6: 温暖、私人    "你走之后我看了星星..."
  │     Lv.7-10: 亲密、深入   "其实你不在的时候我很怕黑..."
  │
  ├─ 存储信件到 SQLite: letters 表
  │
  └─ 前端挂载时:
       检查 pending_letters > 0
       如果是: 显示通知低语 + 信封动画
```

**IPC 命令（新增）：**

| 命令 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `get_pending_letters` | 无 | `LetterData[]` | 上次会话以来的未读信件 |
| `mark_letter_read` | `letter_id: i64` | void | 标记信件为已读 |
| `send_letter_reply` | `letter_id: i64, content: string` | void | 回复信件 |
| `get_letter_archive` | `page: i32, limit: i32` | `LetterData[]` | 分页信件历史 |

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：NPC 邮件 | 动物森友会 — 村民信件系统配评分 + 礼物 | [jamchamb: 逆向 AC 信件系统](https://jamchamb.net/projects/animal-crossing-letters) |
| 游戏：邮件系统 | 动物森友会 — 所有系列作品的信件机制 | [AC Wiki: Letter](https://animalcrossing.fandom.com/wiki/Letter) |
| 游戏：离线消息 | 电子宠物 — 设备关闭时发生的事件 | [Tamagotchi Wiki](https://tamagotchi.fandom.com/wiki/Tamagotchi) |
| 游戏：每日信件 | 星露谷物语 — NPC 邮件配任务钩子和礼物 | 搜索："Stardew Valley mail system" |

---

### 4.13 Journal / 日记（编年史）

**层级：** 回顾 | **表面：** 独立 WebviewWindow

从宠物视角自动生成的日记，记录每天的事件。条目包括：进行的对话、care 操作、心情轨迹、值得注意的事件，以及宠物的主观评论。用户按日期浏览。里程碑（羁绊升级、一周年纪念日、第 100 次对话）会被标注。灵感来自 Persona 的日历系统和星露谷物语的日记。

**ASCII 原型 — 日记主视图：**

```
    ┌─────────────────────────────────────────────┐
    │  📖 Ditto 的日记                     ── × │
    │─────────────────────────────────────────────│
    │                                             │
    │  ◀ 2026 年 4 月                         ▶  │
    │  ┌───┬───┬───┬───┬───┬───┬───┐             │
    │  │一 │二 │三 │四 │五 │六 │日 │             │
    │  ├───┼───┼───┼───┼───┼───┼───┤             │
    │  │   │   │   │ 1 │ 2 │ 3 │ 4 │             │
    │  │   │   │   │ 😊│ 😐│ 😊│ 😊│             │
    │  ├───┼───┼───┼───┼───┼───┼───┤             │
    │  │...│...│...│...│...│...│...│             │
    │  ├───┼───┼───┼───┼───┼───┼───┤             │
    │  │21 │22 │23 │24★│   │   │   │             │
    │  │ 😊│ 😢│ 😊│ 😊│   │   │   │  ★=今天    │
    │  └───┴───┴───┴───┴───┴───┴───┘             │
    │                                             │
    │─────────────────────────────────────────────│
    │                                             │
    │  📅 2026-04-24（周四）                      │
    │  🌤 心情: 开心 (82/100)                     │
    │                                             │
    │  · 主人一早就开始写代码了                   │
    │  · 中午主人喂我吃了鸡腿，好好吃！          │
    │  · 下午主人让我看了一段猫视频，有点嫉妒    │
    │  · 和 Luna 聊了会天，她说我太黏人了         │
    │                                             │
    │  📊 统计                                    │
    │  对话: 8  |  Care 操作: 3                   │
    │  散步: 2.4km    |  心情范围: 65-88          │
    │                                             │
    │  🏆 里程碑: 30 天纪念日！                   │
    │                                             │
    └─────────────────────────────────────────────┘
```

**ASCII 原型 — 里程碑条目：**

```
    │  🏆 里程碑 — 第 30 天纪念日                  │
    │  ┌─────────────────────────────────────┐    │
    │  │                                     │    │
    │  │  🎉 今天是我们相识 30 天！           │    │
    │  │  羁绊等级 → Lv.5                    │    │
    │  │                                     │    │
    │  │  迄今统计：                          │    │
    │  │  · 交换了 847 条消息                │    │
    │  │  · 142 次 care 操作                 │    │
    │  │  · 最爱的食物：鸡腿（28次）         │    │
    │  │  · 最长对话：45 分钟                │    │
    │  │  · 你让我哭的次数：2                │    │
    │  │  · 你让我笑的次数：89               │    │
    │  │                                     │    │
    │  └─────────────────────────────────────┘    │
```

**日记条目生成：**

```
每天结束时（或次日早晨）
  │
  ├─ 查询 SQLite:
  │   · messages WHERE date = today
  │   · care_actions WHERE date = today
  │   · state_transitions WHERE date = today
  │   · 心情快照（每小时）
  │
  ├─ 为 Agent 构建日记提示词：
  │   "从你的视角总结今天，写成日记条目。
  │    事实：{conversations}, {care}, {mood_graph}, {notable_events}。
  │    使用第一人称，3-5 个要点，与性格一致。"
  │
  ├─ Agent 生成日记文本
  │
  ├─ 检查里程碑：
  │   · days_since_creation
  │   · total_conversations
  │   · bond_level 变化
  │
  └─ 存储到 SQLite: journal_entries 表
```

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：日历日记 | Persona 5 — 带事件跟踪和日程摘要的每日日历 | 搜索："Persona 5 calendar UI system" |
| 游戏：日记 | 星露谷物语 — 带事件记录的每日日记 | [Stardew Valley Wiki](https://stardewvalleywiki.com/) |
| 游戏：思维内阁 | 极乐迪斯科 — 作为反思日记的思维内阁 | [Game Design Thinking 分析](https://gamedesignthinking.com/disco-elysium-rpg-system-analysis/) |
| 游戏：冒险日志 | 塞尔达：旷野之息 — 带任务和记忆跟踪的冒险日志 | 搜索："BotW adventure log UI" |

---

### 4.14 Bond Level / Confidant（关系进阶）

**层级：** 元 | **表面：** DOM 覆盖层（指示器）+ Dialog Panel（升级仪式）

一个离散的关系等级（1-10）量化宠物与用户的羁绊。等级解锁新行为、对话深度和功能。进度通过宠物附近的小指示器显示。升级触发特殊仪式（动画 + 音效 + 通知）。这为整个交互系统提供了明确的进阶感。直接灵感来自 Persona 的社交链 / Confidant 系统。

**ASCII 原型 — 羁绊指示器（始终可见，宠物附近）：**

```
    ┌──────────┐  Lv.5  💚💚💚💚💚○○○○○
    │  (宠物)  │  ────────────────────────
    └──────────┘  下一级: 230 / 500 pts

    （指示器：小巧、不显眼，位于宠物窗口右下角）
```

**ASCII 原型 — 升级仪式：**

```
    ┌─────────────────────────────────────────────┐
    │                                             │
    │              ✨  ✨  ✨  ✨                  │
    │            ┌──────────────┐                  │
    │            │   羁绊提升！ │                  │
    │            │  Lv.4 → Lv.5 │                  │
    │            └──────────────┘                  │
    │              ✨  ✨  ✨  ✨                  │
    │                                             │
    │            ┌──────────┐                     │
    │            │  (宠物)  │  ← 特殊              │
    │            │  🎉      │    动画               │
    │            └──────────┘                     │
    │                                             │
    │  "我觉得我们越来越亲近了呢..."              │
    │                                             │
    │  🔓 解锁：梦之钉（按住 Alt+悬停              │
    │     可读取内心想法）                         │
    │                                             │
    │                       [确定]                 │
    └─────────────────────────────────────────────┘
```

**羁绊等级表：**

| 等级 | 称号 | 所需点数 | 解锁 | 系统提示词修饰 |
|------|------|----------|------|---------------|
| 1 | 陌生人 | 0 | 基础 bark, bubble | 正式、保留 |
| 2 | 相识 | 50 | Thought Bubble 图标 | 稍微温暖 |
| 3 | 朋友 | 150 | Radial Menu, Emote Wheel | 随意，偶尔开玩笑 |
| 4 | 好友 | 300 | Touch Zone 反应 | 分享观点，调侃 |
| 5 | 密友 | 500 | Dream Nail, Dialog Panel VN 主题 | 私人化，记住细节 |
| 6 | 挚友 | 800 | Command Input, Letter 系统 | 脆弱面，倾诉 |
| 7 | 家人 | 1200 | Journal, Mini-Games | 深度信任，担心/关怀 |
| 8 | 灵魂伴侣 | 1800 | Skit 系统（多 Agent） | 直觉式，接话 |
| 9 | 形影不离 | 2500 | Chat Log 开发者视图 | 亲密，哲学思考 |
| 10 | 心灵相通 | 3500 | 隐藏动画，秘密对话，自定义称号 | 完全真实，不加过滤 |

**点数来源：**

| 行为 | 点数 | 频率限制 |
|------|------|----------|
| 聊天消息（用户） | +2 | 100/天 |
| 聊天消息（Agent 回复） | +1 | 100/天 |
| 投喂 | +5 | 5/天 |
| 抚摸（触摸区域） | +3 | 10/天 |
| 玩耍（迷你游戏） | +8 | 3/天 |
| 表情交流 | +2 | 10/天 |
| 回信 | +15 | 2/天 |
| 每日登录 | +10 | 1/天 |
| 使用梦之钉 | +5 | 3/天 |

**交互流程：**

```
任何交互发生                     BondLevelMode                 InteractionRouter
──────────                      ─────────────                 ─────────────────
  │
  ├─ dispatch(InteractionEvent)
  │                               │
  │                               ├─ 根据事件计算点数
  │                               │
  │                               ├─ 累计到 bond_points
  │                               │
  │                               ├─ 如果 bond_points >= next_level_threshold:
  │                               │     │
  │                               │     ├─ 发出 SystemOutput({
  │                               │     │    kind: 'bond_level_up',
  │                               │     │    oldLevel: 4,
  │                               │     │    newLevel: 5
  │                               │     │  })
  │                               │     │
  │                               │     ├─ 播放仪式动画
  │                               │     ├─ 显示解锁通知
  │                               │     └─ 更新系统提示词人格
  │                               │
  │                               └─ 更新指示器显示
```

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：社交链 | Persona 3/4/5 — 社交链 / Confidant 等级系统 | [Gamedeveloper: P3/P4/P5 对比](https://www.gamedeveloper.com/design/same-but-different---comparing-the-social-link-system-in-persona-3-4-5) |
| 文章：社交链精妙设计 | "The Brilliance of the Social Link System" | [Medium: Michelle Kwan](https://mchllshell.medium.com/the-brilliance-that-is-the-social-link-system-of-the-persona-series-4bf5eadd3567) |
| 游戏：支援等级 | 火焰纹章 — 支援对话等级（C/B/A/S）解锁更深对话 | 搜索："Fire Emblem support rank system" |
| 游戏：友好度等级 | 星露谷物语 — NPC 友好度爱心与事件解锁 | [Stardew Valley Wiki: Friendship](https://stardewvalleywiki.com/Friendship) |
| 游戏：羁绊等级 | JRPG — 12 个最佳社交链系统排名 | [icicledisaster.com](https://icicledisaster.com/best-social-link-systems-jrpgs/) |

---

### 4.15 Skit 系统（多 Agent 剧场）

**层级：** 元 | **表面：** 独立 WebviewWindow | **需要：** 多个 Agent 活跃

当桌面上存在两个或更多 Agent（宠物）时，它们可以自发产生"短剧"——用户观看它们之间的简短对话交流。短剧提供角色发展、宠物间关系建设和娱乐。用户是旁观者，不是参与者。灵感来自《传说》系列的短剧系统。

**ASCII 原型 — 短剧通知：**

```
    ┌──────────┐    12px 间距    ┌──────────┐
    │  Ditto   │                │  Luna    │
    │  精灵    │                │  精灵    │
    └──────────┘                └──────────┘
         │                           │
         └───────────┬───────────────┘
                     │
    ┌────────────────┴────────────────┐
    │ 💬 Ditto 和 Luna 想聊天！      │ ← 短剧通知
    │    [观看] [跳过]               │
    └─────────────────────────────────┘
```

**ASCII 原型 — 短剧播放中：**

```
    ┌─────────────────────────────────────────────┐
    │                短剧："星空下"                │
    │─────────────────────────────────────────────│
    │                                             │
    │  ┌──────┐                      ┌──────┐    │
    │  │Ditto │                      │ Luna │    │
    │  │ 😊   │                      │ 😐   │    │
    │  └──────┘                      └──────┘    │
    │                                             │
    │  Ditto: Luna你在看什么？                    │
    │                                             │
    │  Luna: 主人又在写代码了...                  │
    │                                             │
    │  Ditto: 要不要去捣乱？                     │
    │                                             │
    │  Luna: ...算了，上次被骂了                  │
    │                                             │
    │─────────────────────────────────────────────│
    │  [继续]                          [跳过全部] │
    └─────────────────────────────────────────────┘
```

**短剧生成：**

```
短剧触发条件（定期检查）：
  │
  ├─ 两个或更多 Agent 活跃
  ├─ 最近 30 分钟内无短剧
  ├─ 用户处于闲置状态（未与任何宠物交互）
  │
  └─ 选择短剧话题：
       │
       ├─ 基于上下文：两个宠物共享近期观察
       │   （例如，都注意到用户在加班）
       │
       ├─ 基于关系：有历史的宠物生成玩笑话
       │   （例如，Ditto 昨天调侃了 Luna，Luna 今天反击）
       │
       └─ 随机：从通用宠物间话题库中选择
            （天气、食物偏好、用户习惯）

短剧生成提示词（发送给 Agent A，包含 Agent B 的上下文）：
  "在你自己（{pet_a_name}，
   性格：{traits_a}）和 {pet_b_name}（性格：{traits_b}）
   之间生成一段 4-8 行的简短对话。
   话题：{topic}。保持自然、简短、有趣。"
```

**参考来源：**

| 类别 | 参考 | URL |
|------|------|-----|
| 游戏：短剧系统 | 传说系列 — 可选的角色配音短剧 | [Aselia Wiki: Skits](https://aselia.fandom.com/wiki/Skits) |
| 游戏：短剧视频 | "The Life of the Party — How Skits Bring the Tales Series to Life" | [YouTube](https://www.youtube.com/shorts/LNF9hH56YO8) |
| 游戏：短剧实现 | 在 RPG Maker 中实现传说系列风格短剧的 DIY 指南 | [Reddit: r/RPGMaker](https://www.reddit.com/r/RPGMaker/comments/7s7n39/diy_guide_to_tales_of_series_style_skits/) |
| 游戏：队伍闲聊 | 博德之门 3 — 同伴插话系统 | [Larian 论坛](https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=881187) |

---

## 5. 交互配置模式

### 5.1 配置格式：`interaction-config.json`

```json
{
  "schema_version": "1.0",
  "active_profile": "nurture",

  "profiles": {
    "minimal": {
      "description": "低干扰。宠物含蓄地表达自己。",
      "modes": {
        "bark":           { "enabled": true },
        "thought_bubble": { "enabled": true },
        "speech_bubble":  { "enabled": false },
        "radial_menu":    { "enabled": true },
        "emote_wheel":    { "enabled": false },
        "touch_zone":     { "enabled": false },
        "dialog_panel":   { "enabled": false },
        "command_input":  { "enabled": false },
        "chat_log":       { "enabled": false },
        "mini_game":      { "enabled": false },
        "dream_nail":     { "enabled": false },
        "letter":         { "enabled": false },
        "journal":        { "enabled": false },
        "bond_level":     { "enabled": true },
        "skit":           { "enabled": false }
      },
      "gesture_map": {
        "double_click": "bark",
        "context_menu": "radial_menu"
      }
    },

    "nurture": {
      "description": "完整养成体验。与你的宠物深度羁绊。",
      "modes": {
        "bark":           { "enabled": true },
        "thought_bubble": { "enabled": true },
        "speech_bubble":  { "enabled": true },
        "radial_menu":    { "enabled": true },
        "emote_wheel":    { "enabled": true },
        "touch_zone":     { "enabled": true },
        "dialog_panel":   { "enabled": true },
        "command_input":  { "enabled": false },
        "chat_log":       { "enabled": false },
        "mini_game":      { "enabled": true },
        "dream_nail":     { "enabled": true },
        "letter":         { "enabled": true },
        "journal":        { "enabled": true },
        "bond_level":     { "enabled": true },
        "skit":           { "enabled": true }
      },
      "gesture_map": {
        "double_click": "dialog_panel",
        "context_menu": "radial_menu",
        "alt_hover": "dream_nail",
        "emote_key": "emote_wheel"
      }
    },

    "rpg": {
      "description": "完整 RPG 体验。指挥你的伙伴。",
      "modes": {
        "bark":           { "enabled": true },
        "thought_bubble": { "enabled": true },
        "speech_bubble":  { "enabled": true },
        "radial_menu":    { "enabled": true },
        "emote_wheel":    { "enabled": true },
        "touch_zone":     { "enabled": true },
        "dialog_panel":   { "enabled": true },
        "command_input":  { "enabled": true },
        "chat_log":       { "enabled": true },
        "mini_game":      { "enabled": true },
        "dream_nail":     { "enabled": true },
        "letter":         { "enabled": true },
        "journal":        { "enabled": true },
        "bond_level":     { "enabled": true },
        "skit":           { "enabled": true }
      },
      "gesture_map": {
        "double_click": "command_input",
        "context_menu": "radial_menu",
        "alt_hover": "dream_nail",
        "emote_key": "emote_wheel",
        "shift_click": "chat_log"
      }
    }
  },

  "mode_overrides": {}
}
```

### 5.2 手势-模式映射规则

| 手势 | 描述 | 默认值（养成模式） | 可配置 |
|------|------|-------------------|--------|
| `double_click` | 双击宠物 | 打开对话面板 | 是 |
| `context_menu` | 右键点击宠物 | 打开环形菜单 | 是 |
| `alt_hover` | Alt+悬停宠物 | 激活梦之钉 | 是 |
| `emote_key` | 按 E 键 | 打开表情轮盘 | 是 |
| `shift_click` | Shift+点击宠物 | 打开聊天日志 | 是 |
| `long_press` | 长按 >500ms | 打开环形菜单（备选） | 是 |
| `hover` | 光标进入宠物范围 | 触摸区域检测 | 否（Touch Zone 启用时始终激活） |

### 5.3 模式兼容性规则

并发激活规则：

```
始终可并发（可与任何模式同时激活）：
  bark, thought_bubble, touch_zone, bond_level

互斥组（每组只能激活一个）：
  A 组（主对话）：  speech_bubble | dialog_panel | command_input | chat_log
  B 组（操作菜单）：radial_menu | emote_wheel

独立（自由激活/停用）：
  dream_nail, letter, journal, mini_game, skit
```

---

## 6. 与现有系统的集成

### 6.1 前端重构：`main.ts`

当前硬编码的手势处理器替换为 `InteractionRouter`：

```
当前                                 重构后
────                                 ────────
canvas.addEventListener              const router = new InteractionRouter(config);
  ('dblclick', toggleChatWindow)     router.mount(canvas, overlayDiv, context);
                                     // router 内部：
canvas.addEventListener              //   dblclick → config.gesture_map.double_click
  ('contextmenu', openCarePanel)     //   contextmenu → config.gesture_map.context_menu
                                     //   keydown 'e' → config.gesture_map.emote_key
listen('pet-action', ...)            //   alt+mousemove → config.gesture_map.alt_hover
                                     //   pet-action → router.handleAgentAction()
```

### 6.2 后端：新增 IPC 命令

| 命令 | 模块 | 描述 |
|------|------|------|
| `get_bond_level` | `care/bond.rs`（新增） | 返回当前羁绊等级 + 点数 |
| `add_bond_points` | `care/bond.rs`（新增） | 添加交互点数，检查升级 |
| `get_pending_letters` | `agent/letter.rs`（新增） | 获取未读信件 |
| `mark_letter_read` | `agent/letter.rs`（新增） | 标记信件为已读 |
| `send_letter_reply` | `agent/letter.rs`（新增） | 回复信件 |
| `generate_inner_thought` | `agent/core.rs`（扩展） | 梦之钉：生成内心独白 |
| `get_journal_entries` | `db/journal.rs`（新增） | 按日期范围获取日记条目 |
| `generate_journal_entry` | `agent/journal.rs`（新增） | 生成每日日记条目 |
| `get_interaction_config` | `db/settings.rs`（扩展） | 获取交互配置 |
| `save_interaction_config` | `db/settings.rs`（扩展） | 保存交互配置 |
| `start_skit` | `agent/skit.rs`（新增） | 生成多 Agent 短剧对话 |
| `start_mini_game` | `care/minigame.rs`（新增） | 初始化迷你游戏会话 |
| `submit_mini_game_result` | `care/minigame.rs`（新增） | 提交游戏结果，应用 care 效果 |

### 6.3 后端：Agent 提示词扩展

`agent/prompt.rs` 系统提示词模板增加羁绊等级感知：

```
当前提示词模板                    扩展后的提示词模板
──────────────                    ────────────────────
"You are {pet_name}..."           "You are {pet_name}..."
"Personality traits: ..."         "Personality traits: ..."
                                  "Bond Level: {bond_level}/10 ({bond_title})"
                                  "Interaction style: {bond_style_guide}"
                                  
                                  羁绊风格指南按等级变化：
                                  Lv.1-2: "礼貌而保留。使用正式语言。"
                                  Lv.3-4: "友好而随意。偶尔开玩笑。"
                                  Lv.5-6: "个人化而温暖。分享你的感受。"
                                  Lv.7-8: "深度信任。倾诉脆弱之处。"
                                  Lv.9-10: "完全真实。不加过滤。"
```

### 6.4 后端：新增数据库表

```sql
-- 羁绊等级追踪
CREATE TABLE bond_level (
    agent_id TEXT PRIMARY KEY,
    level INTEGER NOT NULL DEFAULT 1,
    points INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

-- 信件系统
CREATE TABLE letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('to_user', 'from_user')),
    content TEXT NOT NULL,
    attachment TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL
);

-- 日记条目
CREATE TABLE journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    content TEXT NOT NULL,
    mood_summary TEXT,
    stats_json TEXT,
    milestone TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(agent_id, entry_date)
);

-- 迷你游戏历史
CREATE TABLE mini_game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    game_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    won INTEGER NOT NULL,
    care_effects_json TEXT,
    played_at TEXT NOT NULL
);
```

### 6.5 FSM 扩展

不需要新增 `PetState` 变体。现有的 16 个状态覆盖了所有交互模式需求：

| 交互模式操作 | 映射到现有 PetState |
|-------------|---------------------|
| Touch Zone: 摸头 | `happy` |
| Touch Zone: 抓尾巴 | `curious` → 快速返回 `idle` |
| Emote: 用户挥手 | `happy` |
| Emote: 用户训斥 | `sad` |
| Mini-Game: 游戏中 | `play` |
| Skit: 宠物说话 | `talk` |
| Letter: 递送中 | `happy` + bark |

### 6.6 Care 系统扩展

`care/needs.rs` — 为 `apply_care_action` 新增交互奖励类型：

| 新增操作 | 效果 | 来源模式 |
|---------|------|---------|
| `emote_positive` | 快乐 +5，社交 +5 | Emote Wheel |
| `emote_negative` | 快乐 -5 | Emote Wheel |
| `pet_head` | 快乐 +10 | Touch Zone |
| `pet_body` | 快乐 +5 | Touch Zone |
| `pet_belly` | 快乐 +8 | Touch Zone |
| `pet_tail` | 快乐 -3 | Touch Zone |
| `mini_game_win` | 快乐 +15，精力 -5 | Mini-Game |
| `mini_game_lose` | 快乐 +8，精力 -3 | Mini-Game |
| `letter_reply` | 社交 +15 | Letter |
| `dream_nail` | 社交 +5 | Dream Nail |

---

## 7. 参考来源总表

| # | 模式 | 游戏参考 1 | 游戏参考 2 | 视频 / 文章 | 开源 |
|---|------|-----------|-----------|------------|------|
| 1 | Bark | Hades — NPC 环境对话 | 博德之门 3 — 队伍闲聊 | [YouTube: Hades 对话系统](https://www.youtube.com/watch?v=bwdYL0KFA_U) | [CATAI: 喵喵泡泡](https://github.com/wil-pe/CATAI) |
| 2 | Thought Bubble | 模拟人生 4 — 状态菱 + 情绪图标 | 电子宠物 — 需求图标 | [EA: Sims 4 Emotions](https://www.ea.com/games/the-sims/the-sims-4) | [VPet: 心情指示器](https://github.com/LorisYounger/VPet) |
| 3 | Speech Bubble | Undertale — 对话框打字机 | 动物森友会 — 村民对话 | [textBobber: VN 打字机](https://github.com/ht-devx/textBobber) | [SenangWebs Story](https://github.com/a-hakim/senangwebs-story) |
| 4 | Radial Menu | 圣剑传说 — 环形指令（1993） | 质量效应 — 技能轮盘 | [Medium: 环形菜单历史](https://medium.com/design-bootcamp/the-history-of-radial-menus-in-video-games-e6968bb1bac6) | [RadialMenu.js](https://github.com/nicoco007/RadialMenu.js) |
| 5 | Emote Wheel | 黑暗之魂 — 手势系统 | 怪猎崛起 — 贴纸 | [AC Wiki: Reactions](https://animalcrossing.fandom.com/wiki/Reactions) | （环形菜单库通用） |
| 6 | Touch Zone | Pokemon-Amie — 甜蜜点/危险区 | 任天狗 — 触控笔抚摸 | [Bulbapedia: Petting](https://bulbapedia.bulbagarden.net/wiki/Petting) | [pixi-live2d-display: hitTest](https://github.com/guansss/pixi-live2d-display) |
| 7 | Dialog Panel | Persona 5 — Confidant 对话 | 火焰纹章 — 支援对话 | [Gamedeveloper: P3/P4/P5 社交链](https://www.gamedeveloper.com/design/same-but-different---comparing-the-social-link-system-in-persona-3-4-5) | [Ren'Py: VN 引擎](https://www.renpy.org/) |
| 8 | Command Input | Zork — 动词-名词文本解析器 | AI Dungeon — 自然语言游戏命令 | （DeskPet 命令系统） | [DeskPet: 脚本化宠物](https://emmowo.itch.io/deskpet) |
| 9 | Chat Log | FFXIV — 多标签聊天面板 | WoW — 战斗日志 + 聊天 | 搜索："FFXIV chat panel design" | （标准聊天 UI 模式） |
| 10 | Mini-Game | Pokemon-Amie — Head It / Berry Picker | 任天狗 — 飞盘/球 | [Bulbapedia: Pokemon-Amie](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon-Amie) | [VPet: 集成游戏](https://github.com/LorisYounger/VPet) |
| 11 | Dream Nail | 空洞骑士 — 梦之钉读取 NPC 想法 | 极乐迪斯科 — 内心声音 | [YouTube: 梦之钉对话](https://www.youtube.com/watch?v=04bjkW8MV9s) | （无直接 OSS 等价物） |
| 12 | Letter | 动物森友会 — 村民邮件 + 评分 | 星露谷物语 — NPC 邮件 | [jamchamb: 逆向 AC 信件](https://jamchamb.net/projects/animal-crossing-letters) | （无直接 OSS 等价物） |
| 13 | Journal | Persona 5 — 每日日历系统 | 星露谷物语 — 事件日记 | [Game Design Thinking: DE 分析](https://gamedesignthinking.com/disco-elysium-rpg-system-analysis/) | （无直接 OSS 等价物） |
| 14 | Bond Level | Persona 5 — Confidant 等级 1-10 | 星露谷物语 — 友好度爱心 | [Medium: 社交链精妙设计](https://mchllshell.medium.com/the-brilliance-that-is-the-social-link-system-of-the-persona-series-4bf5eadd3567) | （无直接 OSS 等价物） |
| 15 | Skit | 破晓传说 — 队伍短剧 | 博德之门 3 — 同伴闲聊 | [Aselia Wiki: Skits](https://aselia.fandom.com/wiki/Skits) | [RPGMaker 短剧指南](https://www.reddit.com/r/RPGMaker/comments/7s7n39/diy_guide_to_tales_of_series_style_skits/) |

---

## 8. 实现阶段

### 阶段 I — 基础 + 被动 + 轻度基础（2 周）

**内容：**
- InteractionRouter 核心架构（出站总线、入站总线、手势分发）
- 重构 `main.ts` 使用 InteractionRouter 替代硬编码处理器
- BarkMode（canvas/DOM 覆盖层配打字机 + 淡出）
- ThoughtBubbleMode（图标覆盖层配动画）
- SpeechBubbleMode（DOM 覆盖层配打字机、快速回复芯片）
- RadialMenuMode（SVG/CSS 环形，4 个默认 care 项目）
- Bond Level 后端（SQLite 表、点数累计、等级计算）
- Bond Level 指示器（DOM，宠物附近的小显示）

**交付物：**
- `src/interaction/router.ts` — InteractionRouter 类
- `src/interaction/modes/bark.ts`
- `src/interaction/modes/thought-bubble.ts`
- `src/interaction/modes/speech-bubble.ts`
- `src/interaction/modes/radial-menu.ts`
- `src/interaction/modes/bond-level.ts`
- `src-tauri/src/care/bond.rs` — 羁绊等级后端
- `src-tauri/src/db/migrations.rs` — `bond_level` 表

**验证：**
- [ ] InteractionRouter 根据配置正确分发手势
- [ ] Bark 文本出现在宠物上方，打字机效果，自动淡出
- [ ] Thought 图标在 care 需求紧急时出现
- [ ] Speech bubble 显示 Agent 回应配快速回复芯片
- [ ] Radial menu 右键打开，选择 care 操作
- [ ] Bond 点数从所有交互中累计
- [ ] Bond level 指示器在宠物附近更新

**前置条件：** 无（阶段 I 自包含，基于现有代码库构建）

---

### 阶段 II — 轻度完善 + 主动入门（2 周）

**内容：**
- TouchZoneMode（`skin.json` 中的区域地图、hitTestZone 委派、区域特定反应）
- EmoteWheelMode（表情选择轮盘、回应映射、care 效果）
- DialogPanelMode / VN 风格（将当前 `chat-bubble.ts` WebviewWindow 重构为带头像、历史、建议回复的 DialogPanel）
- Bond Level 升级仪式（动画、解锁通知）
- 将 Bond Level 集成到 Agent 系统提示词（`agent/prompt.rs`）

**交付物：**
- `src/interaction/modes/touch-zone.ts`
- `src/interaction/modes/emote-wheel.ts`
- `src/interaction/modes/dialog-panel.ts` + `dialog.html`
- 扩展 `skin.json` schema 增加 `touch_zones` 字段
- `src-tauri/src/agent/prompt.rs` — 羁绊等级提示词修饰

**验证：**
- [ ] 悬停在宠物头部/身体/尾巴上产生不同反应
- [ ] 表情轮盘打开，选择表情触发宠物回应 + care 效果
- [ ] 对话面板展示 VN 风格对话配头像和历史
- [ ] 羁绊升级触发仪式动画
- [ ] Agent 语调根据羁绊等级变化

**前置条件：** 阶段 I 完成（InteractionRouter、BondLevel 后端）

---

### 阶段 III — 主动层 + 回顾层（3 周）

**内容：**
- CommandInputMode（内联终端、自动补全、命令解析）
- ChatLogMode（持久多标签日志面板）
- MiniGameMode（石头剪刀布 + 接食物）
- DreamNailMode（Alt+悬停内心想法覆盖层、次级 Agent 提示词）
- LetterMode（离线信件生成、信封通知、回信系统）
- JournalMode（每日条目生成、日历视图、里程碑追踪）
- 新增 SQLite 表：`letters`、`journal_entries`、`mini_game_results`
- 以上所有的新增 IPC 命令

**交付物：**
- `src/interaction/modes/command-input.ts`
- `src/interaction/modes/chat-log.ts` + `chatlog.html`
- `src/interaction/modes/mini-game.ts` + `minigame.html`
- `src/interaction/modes/dream-nail.ts`
- `src/interaction/modes/letter.ts` + `letter.html`
- `src/interaction/modes/journal.ts` + `journal.html`
- `src-tauri/src/agent/letter.rs`
- `src-tauri/src/agent/journal.rs`
- `src-tauri/src/care/minigame.rs`
- `src-tauri/src/db/migrations.rs` — 3 个新表

**验证：**
- [ ] 命令输入正确解析 "feed"、"play"、"status"
- [ ] 聊天日志显示所有消息类型并支持标签过滤
- [ ] 石头剪刀布迷你游戏进行 5 轮，影响 care 数值
- [ ] 梦之钉（Alt+悬停）显示与公开发言不同的内心想法
- [ ] 离线 4 小时以上后生成信件，启动时递送
- [ ] 日记条目每日自动生成，包含心情和事件摘要
- [ ] 所有模式遵守羁绊等级解锁（锁定模式显示"达到 Lv.X 解锁"）

**前置条件：** 阶段 II 完成（TouchZone、DialogPanel、BondLevel 仪式）

---

### 阶段 IV — 多 Agent + 打磨（2 周）

**内容：**
- SkitMode（多 Agent 对话生成、短剧通知、播放面板）
- 交互配置预设（极简、养成、RPG）
- 模式切换和手势重映射的设置界面
- 预设导入/导出
- 性能分析和优化
- 无障碍：Radial Menu 和 Emote Wheel 的键盘导航

**交付物：**
- `src/interaction/modes/skit.ts` + `skit.html`
- `src-tauri/src/agent/skit.rs`
- 交互模式管理的设置界面扩展
- `interaction-config.json` schema 最终定稿
- 性能报告

**验证：**
- [ ] 条件满足时两个 Agent 产生短剧对话
- [ ] 短剧播放显示双头像对话
- [ ] 切换时所有 3 个预设配置正常工作
- [ ] 自定义手势映射在重启后持久化
- [ ] Radial menu 和 emote wheel 可通过键盘导航
- [ ] 待机时总交互系统 CPU 开销 < 2%

**前置条件：** 阶段 III 完成，多 Agent 窗口管理（来自 visual-rendering-spec 阶段 D）

---

## 9. 性能预算

### 9.1 每模式预算

| 模式 | DOM 元素 | 动画开销 | 内存 | WebviewWindow |
|------|---------|---------|------|---------------|
| Bark | 1-3 个 `<div>` | 仅 CSS 淡出 | < 1MB | 否 |
| Thought Bubble | 1 个 `<div>` 或 canvas 绘制 | CSS 弹跳 | < 1MB | 否 |
| Speech Bubble | 1 个 `<div>` + 子元素 | CSS 打字机 | < 1MB | 否 |
| Radial Menu | 1 个 SVG + 区段 | CSS 悬停高亮 | < 2MB | 否 |
| Emote Wheel | 1 个 SVG + 区段 | CSS 悬停高亮 | < 2MB | 否 |
| Touch Zone | 0（不可见，仅 hitTest） | 无 | < 1MB | 否 |
| Dialog Panel | 完整 HTML 页面 | 最小 | < 5MB | 是（1 个窗口） |
| Command Input | 1 个 `<div>` 或 WebviewWindow | 光标闪烁 | < 2MB | 可选 |
| Chat Log | 完整 HTML 页面 | 仅滚动 | < 10MB | 是（1 个窗口） |
| Mini-Game | 完整 HTML 页面 | 游戏循环（30fps） | < 5MB | 是（1 个窗口） |
| Dream Nail | 1 个 `<div>` 覆盖层 | CSS 发光 + 淡出 | < 1MB | 否 |
| Letter | 完整 HTML 页面 | 打开/淡出动画 | < 5MB | 是（1 个窗口） |
| Journal | 完整 HTML 页面 | 日历渲染 | < 10MB | 是（1 个窗口） |
| Bond Level | 1 个小 `<div>` | 无（静态） | < 1MB | 否 |
| Skit | 完整 HTML 页面 | 头像切换 | < 5MB | 是（1 个窗口） |

### 9.2 同时模式限制

| 约束 | 限制 | 理由 |
|------|------|------|
| 最大 WebviewWindow（整个应用） | 同时 4 个 | 每个窗口 = Chromium 渲染器进程 |
| 最大 DOM 覆盖层模式 | 同时 6 个 | DOM 模式轻量级 |
| 最大 canvas 覆盖层模式 | 同时 3 个 | 避免 canvas 重绘竞争 |
| 建议总活跃模式数 | 5-8 | 功能与资源使用之间的平衡 |

当前应用已使用：主窗口（1）+ 聊天（1）+ care（1）+ 设置（1）+ 引导（1）= 5 个 WebviewWindow。新架构应将并发次级窗口限制为 3 个（Dialog Panel 或 Chat Log 或 Journal/Letter/Skit——不能同时全部打开）。

### 9.3 CPU 预算

| 状态 | 目标 | 分解 |
|------|------|------|
| 所有模式待机 | < 1% CPU | Bark 轮询：0，Thought：仅 CSS，Bond：静态 |
| 活跃对话（Dialog Panel） | < 3% CPU | 流式 token 渲染，打字机效果 |
| Radial menu 打开 | < 2% CPU | SVG 悬停高亮，角度计算 |
| 迷你游戏运行中 | < 5% CPU | 隔离 WebviewWindow 中 30fps 游戏循环 |
| 短剧播放中 | < 2% CPU | 头像切换 + 文本显示 |

---

## 10. 风险评估

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|---------|
| InteractionRouter 复杂度 | 中 | 过度设计的抽象拖慢开发 | 从 3 模式路由器（Bark+Bubble+Radial）开始，逐步扩展；避免过早泛化 |
| Radial Menu 跨平台鼠标事件 | 中 | `contextmenu` 事件行为在 Win/macOS/Linux 的 Tauri webview 中不同 | 阶段 I 在所有平台测试；如果 contextmenu 不可靠则回退到长按触发 |
| WebviewWindow 资源爆炸 | 高 | 4+ 同时窗口推动 RAM 超过 200MB | 强制最多 3 个次级窗口；延迟创建 WebviewWindow（非预创建）；关闭时销毁 |
| Touch Zone 命中测试精度 | 中 | Sprite 渲染器有固定矩形；不同渲染器有不同区域精度 | 在 `skin.json` 中按渲染器定义区域配置；Spine/Live2D 使用原生命中区域；Sprite 使用可配置矩形 |
| Bond Level + LLM 提示词 token 预算 | 中 | 羁绊风格指南每次提示词增加约 100 token，减少对话的上下文窗口 | 保持羁绊风格指南简洁（2-3 句）；仅在系统提示词层级包含，非每条消息 |
| 梦之钉次级提示词成本 | 低 | 每次梦之钉激活 = 1 次额外 LLM 调用 | 限制为每天 3 次；缓存内心想法 5 分钟；使用本地 LLM（Ollama）生成内心想法 |
| 低羁绊等级时信件生成质量 | 低 | Lv.1-2 时短小、乏味的信件可能感觉无意义 | 仅在 Bond Lv.6+ 时启用信件；低等级信件设计上就很短（1-2 句） |
| 短剧需要多 Agent 基础设施 | 中 | 短剧系统在多 Agent 窗口存在前无法测试 | 阶段 IV 时间线与 visual-rendering-spec 阶段 D 对齐；短剧最后实现 |
| 迷你游戏范围蔓延 | 中 | 游戏倾向于复杂度超出"10-30 秒微游戏"范围 | 严格的 4 游戏目录；在所有 4 个稳定前不添加新游戏；专注于 care 集成而非游戏打磨 |
| 配置 UI 复杂度 | 低 | 15 个模式配每模式设置创建大量设置界面 | 使用预设配置文件作为主要 UX；高级每模式开关放在"高级"标签页；配置可 JSON 编辑供高级用户使用 |

---

## 11. 与现有规范的关系

本规范**取代**以下 PRD 部分：

| PRD 部分 | 被取代为 |
|----------|---------|
| 第 4.3 节 — 用户交互流程 | 本规范，第 2 节 + 第 3 节（InteractionRouter 取代硬编码手势处理） |
| 第 4.3 节 — AI 对话流程 | 本规范，第 4.7 节（DialogPanelMode）+ 第 4.9 节（ChatLogMode）扩展对话 UX |

本规范**扩展**（但不矛盾）：

| PRD 部分 | 扩展为 |
|----------|--------|
| 第 3.2 节 — AI Agent 功能 | 第 4.11 节（梦之钉内心想法）、第 4.12 节（信件生成）、第 4.13 节（日记生成）增加新的 Agent 输出通道 |
| 第 3.3 节 — Care 系统 | 第 4.14 节（Bond Level）在现有需求之上增加进阶元系统 |
| 第 7.2 节 — 交互表 | 第 6.6 节扩展交互类型（表情、触摸区域、迷你游戏、回信） |

本规范**依赖于**：

| 依赖 | 来源 |
|------|------|
| PetRenderer 接口 + hitTest() | visual-rendering-spec.md，第 3.1 节 |
| 多 Agent 窗口管理 | visual-rendering-spec.md，第 2.2 节 |
| 皮肤清单格式（`skin.json`） | visual-rendering-spec.md，第 5.1 节（扩展 `touch_zones`） |
