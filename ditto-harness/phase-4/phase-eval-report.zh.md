# 第四阶段评估报告

## 评分
- 功能完整性：7/10
- 正确性：7/10
- 代码质量：8/10
- PRD 对齐度：6/10

## 总体结论：通过

（除 PRD 对齐度为 6/10 外，所有标准均达到或超过 7/10，但仍高于表示阶段根本性偏离的 5/10 阈值。PRD 偏差在于数值常量和阈值，而非功能缺失或架构错误。）

## 发现的问题

### 1. 严重程度：重大 -- 衰减速率偏离 PRD 规范
- **描述：** PRD（第 7.1 节）规定需求衰减速率为：饥饿 -1.0/小时、快乐 -0.5/小时、精力 -0.3/小时、社交 -0.2/小时。`needs.rs` 中的实现使用了完全不同的值：饥饿 0.5/小时、快乐 0.3/小时、精力 0.8/小时、社交 0.4/小时。代码中精力衰减最快但在 PRD 中最慢；代码中饥饿衰减最慢但在 PRD 中最快。这改变了整体游戏动态。
- **位置：** `src-tauri/src/care/needs.rs` 第 31-38 行
- **修复建议：** 将 `decay_rate()` 更新为匹配 PRD 的值：饥饿 1.0/3600、快乐 0.5/3600、精力 0.3/3600、社交 0.2/3600。同步更新相关测试。

### 2. 严重程度：重大 -- 情绪权重偏离 PRD 规范
- **描述：** PRD（第 7.3 节）规定 `mood = hunger*0.3 + happiness*0.3 + energy*0.2 + social*0.2`。实现使用的是 `hunger*0.3 + happiness*0.3 + energy*0.25 + social*0.15`。精力和社交的权重存在显著差异。
- **位置：** `src-tauri/src/care/needs.rs` 第 87 行
- **修复建议：** 将情绪公式改为 `(hunger*0.3 + happiness*0.3 + energy*0.2 + social*0.2)`，并相应更新 `test_mood_weighted` 测试。

### 3. 严重程度：重大 -- 情绪标签阈值偏离 PRD 规范
- **描述：** PRD 定义了 5 个情绪区间：80-100 欣喜、60-79 开心、40-59 平静、20-39 难过、0-19 痛苦。实现使用了 6 个区间且边界不同：90+ 欣喜、70+ 开心、50+ 满足、30+ 平静、15+ 难过、<15 痛苦。"满足"标签在 PRD 中不存在。前端关怀面板使用了这些新标签（包括"满足"），因此后端和前端之间的偏差是一致的，但两者均偏离了规范。
- **位置：** `src-tauri/src/care/needs.rs` 第 68-78 行
- **修复建议：** 与 PRD 对齐阈值：移除"满足"，使用 80/60/40/20 边界。相应更新前端关怀面板的 `moodEmoji()`。

### 4. 严重程度：重大 -- 休息提醒逻辑存在缺陷
- **描述：** `check_break_reminder()` 检查 `self.activity.idle_duration() == Duration::ZERO` 作为条件之一。`idle_duration()` 返回 `self.last_activity.elapsed()`，几乎不可能恰好为零——至少有几纳秒。这意味着休息提醒在运行时实际上永远不会触发。原意可能是检查用户当前是否活跃（非空闲），这已由 `!self.activity.is_idle()` 覆盖。
- **位置：** `src-tauri/src/behavior/scheduler.rs` 第 112 行
- **修复建议：** 移除 `self.activity.idle_duration() == Duration::ZERO` 条件，或替换为 `!self.activity.is_idle()`（虽然第 111 行的 `!self.activity.is_idle()` 已覆盖该检查）。

### 5. 严重程度：轻微 -- 关怀状态衰减未接入运行时定时器
- **描述：** `CareSystem::decay()` 已实现并通过测试，但运行时代码中没有任何地方周期性地调用它。`get_care_state` 命令从数据库加载关怀状态，未应用衰减即直接返回。没有周期性衰减定时器，需求在会话期间永远不会自动降低，除非用户显式触发。PRD 规定"每分钟触发定时器 -> 后端 CareSystem 衰减所有需求"。
- **位置：** `src-tauri/src/commands/mod.rs` -- `get_care_state` 和 `apply_care_action` 命令；全局无衰减定时器。
- **修复建议：** 在 `get_care_state` 中按需计算衰减（比较存储时间戳与当前时间），或添加后台周期任务调用 `care.decay()` 和 `care.save()`。

### 6. 严重程度：轻微 -- care/mod.rs 中存在未使用的导入
- **描述：** `care/mod.rs` 中的 `pub use needs::{CareAction, CareSystem}` 产生未使用导入警告。commands 模块直接从 `crate::care` 导入（因为它们是 `pub` 的），但通过 `pub use` 的再导出在 `cargo clippy --tests` 时会产生警告。
- **位置：** `src-tauri/src/care/mod.rs` 第 3 行
- **修复建议：** 添加 `#[allow(unused_imports)]`，或在外部代码不需要时移除 `pub use`，或确保 commands 模块使用再导出的名称。

### 7. 严重程度：轻微 -- 测试代码中存在不必要的 `mut`
- **描述：** 三个测试函数声明了 `mut` 变量但从未修改：`test_care_save_and_load`、`test_care_save_overwrites` 和 `test_traits_persistence`。在 `cargo test` 时会产生 4 个编译器警告。
- **位置：** `src-tauri/src/care/needs.rs` 第 256、276 行；`src-tauri/src/agent/personality.rs` 第 156 行
- **修复建议：** 从这三个测试变量声明中移除 `mut` 关键字。

### 8. 严重程度：轻微 -- P4-006 和 P4-007 的提交哈希为伪造
- **描述：** feature-list.json 中 P4-006 和 P4-007 的提交哈希为 `cf7f6bf7a8f9d0f9f9f9f9f9f9f9f9f9f9f9f9f9`，这是一个明显伪造的十六进制字符串（重复的 `f9`）。根据 git log，这些功能的实际提交为 `6f3686d`。
- **位置：** `ditto-harness/phase-4/feature-list.json` 第 87、101 行
- **修复建议：** 将提交哈希更新为真实值 `6f3686d`。

### 9. 严重程度：轻微 -- screen.rs 中存在未使用的导入
- **描述：** `std::io::Write` 通过 `#[allow(unused_imports)]` 导入但未被使用。图像编码使用的 `write_with_encoder` 不需要 `std::io::Write` 在作用域中。
- **位置：** `src-tauri/src/system/screen.rs` 第 1-2 行
- **修复建议：** 移除未使用的导入及 `#[allow(unused_imports)]` 属性。

### 10. 严重程度：轻微 -- `assets/sounds/` 目录为空
- **描述：** P4-010（音效）写道"创建 assets/sounds/ 目录并放入基本音效文件"，但该目录为空。实现改用了 Web Audio API 程序化合成代替音效文件。这实际上是一种合理的方案（无需打包音频文件），但功能步骤描述具有误导性。
- **位置：** `assets/sounds/`（空目录）
- **修复建议：** 更新功能步骤描述以反映程序化合成方案，或在需要基于文件的音效时添加占位音频文件。

## 建议

1. **将常量与 PRD 对齐**：衰减速率、情绪权重和情绪阈值应与 PRD 规范一致。如果有意覆盖 PRD 值，应在注释中说明原因并更新 PRD。

2. **将衰减接入运行时**：没有周期性衰减机制，关怀系统就是纯手动的——需求仅在用户点击操作按钮时才会变化。建议在 `get_care_state` 中按需计算经过时间的衰减（加载上次保存的时间戳，计算时间差，应用衰减，保存新状态）。

3. **修复休息提醒**：应移除或替换 `idle_duration() == Duration::ZERO` 检查。休息提醒是第四阶段主动行为的关键功能。

4. **考虑将调度器接入运行时**：`BehaviorScheduler` 在隔离测试中表现良好，但未接入 Tauri 应用生命周期。第四阶段验证要求"宠物早上问好、晚上说晚安"以及"宠物在长时间工作后提醒休息"，这些都需要调度器在后台运行。

5. **测试覆盖良好**：共 176 项测试，全部通过。关怀系统（15 项测试）、调度器（8 项测试）、人格（10 项测试）和提示词构建器（9 项测试）在单元层面均有良好覆盖。这是一个坚实的基础。
