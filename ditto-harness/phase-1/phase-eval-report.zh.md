# 第一阶段评估报告

**日期：** 2026-04-22
**评估人：** 代码审查代理
**分支：** main
**最近功能提交：** 4a9ba82

## 评分

- 功能完整性：**8/10**
- 正确性：**8/10**
- 代码质量：**7/10**
- PRD 对齐度：**9/10**

## 总体结论：**通过**

（所有标准评分均达到或超过 7/10）

---

## 功能完整性分析（8/10）

8 个功能中有 7 个通过。P1-002（macOS 透明窗口）被正确推迟——该功能需要物理 macOS 硬件，无法在当前的 Windows 开发机器上测试。

| 功能 | 状态 | 验证方法 | 评估 |
|------|------|----------|------|
| P1-001 透明窗口（Windows） | passes: true | 视觉 + 单元测试 | 已确认。`tauri.conf.json` 设置了 `transparent: true`、`decorations: false`。HTML/CSS 强制 `background: transparent`。 |
| P1-002 透明窗口（macOS） | passes: false | 手动（推迟） | 正确推迟。没有 macOS 硬件无法测试。 |
| P1-003 始终置顶 | passes: true | 视觉 + 单元测试 | 已确认。`tauri.conf.json` 设置了 `alwaysOnTop: true`。测试 `test_window_is_always_on_top` 验证了配置。 |
| P1-004 点击穿透 | passes: true | 单元测试 + 实现 | 已确认。`src/input/click-through.ts` 中的 `ClickThroughHandler` 每 50ms 轮询光标位置，根据光标位置处的像素 alpha 值切换 `set_ignore_cursor_events`。 |
| P1-005 宠物点击检测 | passes: true | 单元测试 + 实现 | 已确认。同一个 `ClickThroughHandler` 使用 alpha 阈值 10——alpha 值高于阈值的像素被判定为"在宠物上"并捕获点击。 |
| P1-006 动画帧率 | passes: true | 单元测试 | 已确认。`test_animation_fps_target_achievable` 验证空闲帧率在 4-60 之间。`AnimationPlayer` 使用 `requestAnimationFrame` 并配合正确的 delta-time 累积。 |
| P1-007 内存占用 < 30MB | passes: true | 性能分析 | 空闲时报告 23.4MB RAM。对于使用 WebView2 的 Tauri v2 应用来说合理。 |
| P1-008 二进制大小 < 10MB | passes: true | 构建测量 | Release 二进制文件为 7.9MB（8,269,312 字节），远低于 10MB 阈值。 |

### 差距

- 精灵图只有 9 帧（0-8），排列在一行中。`animations.json` 声明 `columns: 8`，用于从网格计算帧坐标是正确的。然而，目前只定义了"idle"动画。这对于第一阶段是可以接受的，但必须在第二阶段扩展。

---

## 正确性分析（8/10）

### 表现良好的部分

- **全部 11 个 Rust 测试通过**，零失败。测试覆盖了窗口配置属性（透明、无装饰、始终置顶、不可调整大小、跳过任务栏）、命令注册和动画配置有效性。
- **错误处理**：Tauri 命令中的错误处理很干净：`window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())` 正确地将错误转换为字符串以适配 IPC 层。
- **前端错误处理**：`ClickThroughHandler` 将所有 Tauri IPC 调用包装在 try/catch 中，在非 Tauri 环境下静默降级。`SpriteEngine` 在构造时验证 canvas 上下文的可用性。
- **动画计时**：`AnimationPlayer.update()` 正确累积 delta time，并通过 `Math.floor(elapsed / frameDuration)` 处理大 dt 值的跳帧。非循环动画会钳制到最后一帧，并可选择性地过渡到 `next`。
- **精灵渲染**：`SpriteEngine.render()` 使用 `columns`、`frame_width` 和 `frame_height` 的模运算正确计算源矩形。

### 发现的问题

#### 问题 1：轻微 —— 在非 1x DPI 下点击穿透坐标转换可能不正确

- **严重程度：** 轻微
- **描述：** 在 `src/input/click-through.ts` 第 28-29 行，来自 Tauri `cursor_position()` 的屏幕坐标在减去窗口位置之前先除以 `devicePixelRatio`：
  ```
  const localX = (cursorScreenX / scale) - winX;
  const localY = (cursorScreenY / scale) - winY;
  ```
  这里假设 `cursor_position()` 返回物理（缩放后的）像素，而 `window.screenX`/`screenY` 返回 CSS（逻辑）像素。在 Windows WebView2 上确实如此，但除法顺序很重要：如果两者返回相同的坐标空间，除法会引入误差。由于该功能已在目标平台（Windows）上验证通过，当前环境下似乎是正确的。但应在 macOS 上重新验证，因为 DPI 处理方式不同。
- **位置：** `D:\Luiz\Odradek\ditto\src\input\click-through.ts`，第 28-29 行
- **建议修复：** 添加注释说明坐标空间假设。在 P1-002 测试期间在 macOS 上重新验证。

#### 问题 2：轻微 —— 点击穿透使用轮询而非事件驱动方式

- **严重程度：** 轻微
- **描述：** `ClickThroughHandler` 通过 `setInterval` 每 50ms 轮询光标位置。即使鼠标静止不动，这也会产生持续的 IPC 调用。使用 document 上的 `mousemove` 事件监听器会更高效、响应更快。
- **位置：** `D:\Luiz\Odradek\ditto\src\input\click-through.ts`，第 66 行
- **建议修复：** 考虑在第二阶段用 `mousemove` 事件监听器替换轮询方式。当前方式可以工作，但在鼠标不在窗口上时会浪费 CPU 周期进行不必要的 IPC 调用。

#### 问题 3：轻微 —— `AnimationPlayer.update()` 在空动画时可能返回帧 0

- **严重程度：** 轻微
- **描述：** 如果动画有零帧，`update()` 在 `anim.frames.length === 0` 的提前返回检查后返回 0。调用者（`SpriteEngine.render`）会尝试从精灵图渲染第 0 帧，这可能不是期望的后备行为。
- **位置：** `D:\Luiz\Odradek\ditto\src\renderer\animation.ts`，第 43 行
- **建议修复：** 让 `update()` 返回 `Option<number>`，或在 `SpriteEngine.render()` 中添加守卫条件，在帧 ID 无效时跳过渲染。

---

## 代码质量分析（7/10）

### 表现良好的部分

- **架构清晰**：三个明确的层级——Tauri 后端（Rust 命令）、前端渲染器（精灵引擎 + 动画播放器）和输入处理（点击穿透）。每个模块都有单一职责。
- **TypeScript 类型**：`AnimationDef`、`AnimationConfig` 接口正确地为动画 JSON 格式提供了类型定义。`SpriteEngine` 和 `AnimationPlayer` 类使用私有状态进行了良好的封装。
- **无 unsafe Rust**：所有 Rust 代码都使用安全 API。没有任何 `unsafe` 块。
- **无不必要的依赖**：Cargo.toml 恰好有 3 个依赖（tauri、serde、serde_json）——第一阶段所需的最低限度。没有臃肿。
- **前端构建精简**：使用 Vite + TypeScript，无框架开销。整个前端只有 4 个 TypeScript 文件和 1 个 HTML 文件。
- **测试覆盖率**：11 个 Rust 测试覆盖了所有配置不变量。测试是确定性的（读取配置文件、断言属性）且运行快速（总计 <1ms）。

### 发现的问题

#### 问题 4：重要 —— Rust 格式化违规

- **严重程度：** 重要
- **描述：** `cargo fmt --check` 报告 `src-tauri/src/lib.rs` 中存在多处格式化违规。CLAUDE.md 规定 `cargo fmt` 为格式化标准，CI 强制执行 `cargo fmt --check`。这些违规将导致 CI 失败。
- **位置：** `D:\Luiz\Odradek\ditto\src-tauri\src\lib.rs`，多行
- **建议修复：** 运行 `cargo fmt --manifest-path src-tauri/Cargo.toml` 自动修复所有格式化问题。

#### 问题 5：轻微 —— 缺少 Tauri v2 capabilities/permissions 配置

- **严重程度：** 轻微
- **描述：** 没有 `src-tauri/capabilities/` 目录，生成的 `capabilities.json` 为 `{}`。Tauri v2 使用基于能力的安全模型，命令需要显式的权限授予。当前应用可以工作，因为 `cursor_position()` 和 `set_ignore_cursor_events()` 是 `WebviewWindow` 上的方法（通过命令参数访问），但最佳实践是定义 capabilities 文件。在后续阶段添加更多 IPC 命令时，这可能成为阻塞问题。
- **位置：** 缺失文件：`src-tauri/capabilities/default.json`
- **建议修复：** 创建 `src-tauri/capabilities/default.json`，包含 `core:window:allow-cursor-position`、`core:window:allow-set-ignore-cursor-events` 以及应用所需的其他核心权限。

#### 问题 6：轻微 —— commands 模块上的 `cfg(not(test))` 条件编译

- **严重程度：** 轻微
- **描述：** `commands` 模块使用 `#[cfg(not(test))]` 条件编译，这意味着命令函数无法直接进行单元测试。虽然当前测试通过将源文件作为字符串读取来绕过此限制，但这种模式会阻止未来阶段对命令逻辑进行适当的集成测试。
- **位置：** `D:\Luiz\Odradek\ditto\src-tauri\src\lib.rs`，第 2 行
- **建议修复：** 考虑移除 `cfg(not(test))` 条件编译门，改用 Tauri 的测试工具，或至少添加注释说明该条件编译存在的原因。

#### 问题 7：轻微 —— 基于源码读取的测试比较脆弱

- **严重程度：** 轻微
- **描述：** `test_commands_module_exists` 和 `test_command_registered_in_run` 将 `.rs` 源文件作为字符串读取并检查子串匹配。如果函数名稍有变化或格式化改变了字符串，这些测试就会失败。它们测试的是文件内容而非行为。
- **位置：** `D:\Luiz\Odradek\ditto\src-tauri\src\lib.rs`，第 65-83 行
- **建议修复：** 这些测试在第一阶段的引导过程中是可以接受的。在第二阶段及以后，应使用 Tauri 的测试框架替换为实际的命令调用测试。

---

## PRD 对齐度分析（9/10）

### 第一阶段 PRD 需求与实现对比

| PRD 任务 | 已实现 | 备注 |
|----------|--------|------|
| Tauri v2 项目搭建 | 是 | 使用 `cargo tauri` 脚手架创建透明、无边框、始终置顶的窗口 |
| 基本精灵渲染 | 是 | `SpriteEngine` 加载精灵图 PNG + animations.json，渲染到 Canvas 2D |
| 动画循环 | 是 | 基于 `requestAnimationFrame` 的循环，在 `AnimationPlayer` 中使用 delta-time 帧率控制 |
| 空闲动画 | 是 | 8 帧空闲动画（帧序列 [0,1,2,3,4,3,2,1]），8 FPS，循环播放 |
| 窗口透明 | 是 | tauri.conf.json 中设置 `transparent: true`，CSS `background: transparent`，alpha 合成 |
| 点击穿透 | 是 | 通过 alpha 阈值轮询对透明区域使用 `set_ignore_cursor_events(true)` |

### PRD 验证清单

| 验证项 | 状态 |
|--------|------|
| 宠物出现在桌面上且背景透明 | 通过（P1-001） |
| 宠物以目标帧率播放动画 | 通过（P1-006） |
| 点击事件穿透透明区域 | 通过（P1-004） |
| 窗口始终位于其他窗口之上 | 通过（P1-003） |
| 无可见窗口边框或装饰 | 通过（P1-001，通过 `decorations: false` 验证） |

### 超出 PRD 范围的额外功能

- **宠物点击检测**（P1-005）：未在第一阶段 PRD 验证中明确列出，但作为第二阶段拖拽功能的自然前置需求，是具有前瞻性的良好实现。
- **内存分析**（P1-007）和**二进制大小**（P1-008）：在 PRD 第 9.1 节中作为验证步骤列出，正确地提升为被跟踪的功能特性。

### 对齐差距

- PRD 提到 `skipTaskbar: true`，该配置已正确设置并测试，但未作为单独的第一阶段验证步骤列出。它被隐式包含在"无可见窗口边框"验证中。

---

## 总结

第一阶段交付了一个坚实的骨架：一个透明、无边框、始终置顶的 Tauri v2 窗口，配备 Canvas 2D 精灵渲染、空闲动画和点击穿透/点击检测功能。代码干净、精简且结构良好，关注点分离清晰。全部 11 个 Rust 测试通过，clippy 零警告，应用在资源限制范围内运行（23.4MB RAM，7.9MB 二进制文件）。

进入第二阶段前的主要行动项是**修复 Rust 格式化违规**（问题 4），这将阻塞 CI。缺失的 capabilities 文件（问题 5）应在第二阶段早期添加更多 IPC 命令时解决。随着应用的增长，点击穿透的轮询方式（问题 2）应重新审视以优化性能。

**8 个功能中有 7 个通过。** P1-002（macOS 透明度）被正确推迟，等待 macOS 硬件访问。第一阶段已完成，可以进行门控审批。
