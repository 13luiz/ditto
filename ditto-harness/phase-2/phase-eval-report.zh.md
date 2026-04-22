# 第二阶段评估报告

## 评分
- 功能完整性：8/10
- 正确性：8/10
- 代码质量：7/10
- PRD 对齐度：7/10

## 总体结论：通过

所有标准评分均达到或超过 7/10。本阶段交付了可工作的状态机、物理系统、光标交互、拖放和多显示器支持，并具有扎实的测试覆盖率（67 个测试，零失败）。以下问题真实存在但不阻塞阶段门控。

---

## 发现的问题

### 1. 严重程度：轻微 —— 未应用 `cargo fmt`

- **描述：** `cargo fmt --check` 报告 `behavior/cursor.rs`、`behavior/mod.rs`、`behavior/movement.rs` 和 `behavior/state_machine.rs` 中存在格式化差异。长函数签名和断言宏超出了默认行宽。
- **位置：** `src-tauri/src/behavior/cursor.rs`（第 6、17 行）、`src-tauri/src/behavior/mod.rs`（第 1-3 行）、`src-tauri/src/behavior/movement.rs`（第 120、255 行）、`src-tauri/src/behavior/state_machine.rs`（多个测试行）
- **建议修复：** 运行 `cargo fmt --manifest-path src-tauri/Cargo.toml` 并提交结果。CI 流水线（`cargo fmt --check`）在当前代码下会失败。

### 2. 严重程度：重要 —— PRD 第二阶段功能在 feature-list.json 中缺失

- **描述：** PRD 第二阶段表格列出了 9 项任务。其中有两项完全不在 feature-list.json 中：
  1. **随机漫步** —— PRD 说"宠物空闲时自主漫步。"前端 `PetController.startWandering()` 确实实现了基本漫步（每 5 秒有 30% 概率向左走、30% 概率向右走），但 feature-list.json 中没有专门的功能条目。它部分被 P2-005 覆盖，但没有明确的测试或验证。
  2. **屏幕边缘攀爬** —— PRD 说"宠物可以攀爬左/右屏幕边缘。"状态机支持 `walk_* -> climb` 和 `climb -> fall` 转换，但前端 `PetController` 中没有攀爬物理实现。当宠物到达屏幕边缘时只是停下并进入空闲状态。没有实现攀爬动画或沿边缘的垂直移动。P2-001 测试了 FSM 的攀爬转换，但实际的攀爬行为未构建。
- **位置：** `src/behavior/pet-controller.ts` 第 118-131 行（行走到边缘时使用 `setState('idle')` 停止，无攀爬逻辑）；`ditto-harness/phase-2/feature-list.json`（无漫步或攀爬行为的 P2 条目）
- **建议修复：** 要么在后续阶段添加这些功能条目，要么将其标记为已知问题并注明已推迟。FSM 中的攀爬状态在结构上是正确的——只是运行时行为缺失。

### 3. 严重程度：轻微 —— 所有公共 API 表面使用 `#[allow(dead_code)]`

- **描述：** 行为模块中的每个结构体、impl 块和公共函数都标注了 `#[allow(dead_code)]`。在开发期间这是可以的，但它抑制了编译器的自然死代码检测。某些项目（如 `cursor_distance`、`Velocity::zero`、`Position::zero`）确实看起来未被使用。
- **位置：** `src-tauri/src/behavior/state_machine.rs`、`src-tauri/src/behavior/movement.rs`、`src-tauri/src/behavior/cursor.rs`
- **建议修复：** 移除全局的 `#[allow(dead_code)]`，仅在真正需要的地方应用（为未来阶段保留的项目）。让编译器标记真正的死代码。

### 4. 严重程度：轻微 —— 前端状态机未与后端同步

- **描述：** Rust 后端有完整的 `StateMachine`，支持上下文感知的转换（能量检查、情绪检查、光标距离）。前端 `PetController.setState()` 直接设置任何状态而无验证。后端 FSM 经过充分测试但实际上从未在运行时驱动宠物行为——前端单方面做出所有状态决策。这意味着后端 FSM 目前只是没有集成点的库代码。
- **位置：** `src/behavior/pet-controller.ts` 的 `setState()` 方法（第 64-99 行）；状态转换没有 IPC 调用到后端
- **建议修复：** 第二阶段可以接受，因为 FSM 已通过测试验证，将在第三阶段代理通过 IPC 驱动行为时集成。将此记录为第二阶段的有意简化。

### 5. 严重程度：轻微 —— 第二阶段状态的动画定义不完整

- **描述：** `animations.json` 定义了 `idle`、`walk_right`、`walk_left`、`fall` 和 `drag` 的动画（5 个状态）。PRD 第 5.2 节定义了 16 个状态，FSM 支持全部 16 个。缺失的动画定义：`run_left`、`run_right`、`climb`、`sleep`、`eat`、`play`、`talk`、`happy`、`sad`、`curious`、`sit`。`AnimationPlayer.play()` 会调用 `getAnimation()`，对于缺失的状态返回 `undefined`，`update()` 返回帧 0——宠物将渲染精灵图的第一帧作为后备。
- **位置：** `assets/pets/default/animations.json`；`src/renderer/animation.ts` 第 43 行（静默回退到帧 0）
- **建议修复：** 为所有 16 个状态添加占位动画定义。即使复用现有帧（例如 `run_right` 使用 `walk_right` 的帧但帧率更高）也比静默回退更正确。这不是阻塞问题，因为精灵图本身可能没有每个状态的独立美术资源。

### 6. 严重程度：轻微 —— 多显示器检测使用启发式方法

- **描述：** P2-007（多显示器跨越）使用 `window.screen.availWidth` 与 `window.screen.width` 来检测多显示器设置。这是浏览器的启发式方法，不是可靠的 API。Tauri 窗口只有 200x200px，因此跨越显示器意味着将窗口位置移动到主屏幕坐标之外。实现允许宠物走到负 X（左侧屏幕外）或超过 `screenWidth`（右侧），这依赖于操作系统窗口管理器将窗口放置在相邻显示器上。
- **位置：** `src/behavior/pet-controller.ts` 第 44-50、122-129 行
- **建议修复：** 第二阶段可以接受。对于生产环境，应使用 Tauri 的 `availableMonitors()` API 获取精确的显示器几何信息。

### 7. 严重程度：轻微 —— DragHandler 在释放后未重新启用点击穿透

- **描述：** 拖拽开始时，`DragHandler.onMouseDown()` 调用 `set_ignore_cursor_events(false)` 启用指针事件。`onMouseUp()` 后，宠物转换到 `fall` 状态，但从未显式调用 `set_ignore_cursor_events(true)`。`ClickThroughHandler` 的轮询循环最终会在下一个 50ms 周期重新启用它，但存在一个短暂窗口期，期间窗口会捕获所有鼠标事件。
- **位置：** `src/input/drag-handler.ts` 第 38-39、52-56 行
- **建议修复：** 50ms 的轮询间隔使这在实践中无害，但为了代码整洁，应在 `onMouseUp()` 中调用 `set_ignore_cursor_events(true)`。

### 8. 严重程度：轻微 —— 窗口大小在配置中硬编码为 200x200

- **描述：** Tauri 窗口配置为 200x200，但宠物精灵为 64x64。多余的空间（136px）是透明画布。这意味着宠物每侧有 68px 的不可见边距，点击会被捕获但不绘制精灵。`ClickThroughHandler` 通过检查像素 alpha 值正确处理了这一点，但浪费了轮询周期来检查透明区域。
- **位置：** `src-tauri/tauri.conf.json` 第 21 行（width/height 200）
- **建议修复：** 要么将窗口大小设为 64x64（匹配精灵大小），要么在加载动画配置后动态调整窗口大小。这是从第一阶段遗留的问题，不是第二阶段的回归。

---

## 建议

1. **提交前运行 `cargo fmt`。** CI 的 `cargo fmt --check` 门控会拒绝当前格式。这只需一条命令即可修复。

2. **考虑为"随机漫步"添加 feature-list 条目**，即使实现已经存在。测试框架按 ID 跟踪功能，没有明确的条目意味着没有记录正式的验证。

3. **后端 FSM 设计良好但目前在运行时未使用。** 第三阶段的代理集成应该是 Rust 状态机成为权威来源的时机。记录此决策，以便下一阶段知道需要将其接入。

4. **`PetController.update()` 对 `dt > 0.1` 进行了保护**（第 108 行），这意味着如果浏览器标签页被后台化超过 100ms，宠物会冻结而不是追赶进度。对于桌面宠物来说这是合理的选择，但值得注意。

5. **测试覆盖率达到 67 个测试，非常扎实**，对边界情况有良好的覆盖（光标距离的精确边界值、重力着陆检测、无效状态转换）。测试命名具有描述性，测试结构遵循清晰的模式。

6. **`movement.rs` 中的 `apply_gravity` 函数**有一个微妙的逻辑细节：`was_falling` 在 `vy > 0` 或 `y < ground` 时为 true。这意味着如果宠物在地面上被向上推（负 vy），返回时不会报告"着陆"。这是正确的行为——如果你从未离开就不能"着陆"——但值得在注释中说明。

7. **第一阶段测试仍然通过**（11 个配置/动画测试），确认第二阶段的更改没有引入回归。这是良好的代码卫生习惯。
