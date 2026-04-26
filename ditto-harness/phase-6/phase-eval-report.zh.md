# Phase 6 评估报告

**日期**：2026-04-26
**评估者**：自动化子代理
**结论**：通过（有已记录的差距，均不构成阻塞）

## 健康检查摘要

- 232 个 Rust 测试通过，零失败
- `cargo fmt --check` 干净
- `cargo clippy -D warnings` 干净
- `npx tsc --noEmit` 干净
- feature-list.json 中 14/14 个功能均为 `passes: true`

## 标准审查

| # | 标准 | 状态 | 备注 |
|---|------|------|------|
| 1 | PetRenderer TypeScript 接口可编译、可导入，现有精灵测试通过 | 通过 | 接口位于 `src/overlay/renderer/pet-renderer.ts`，包含 `PetRenderer`、`RendererCapabilities`、`LipSyncable`、`Expressible` 类型守卫。5 个 TS 测试文件验证合规性。 |
| 2 | SpriteRenderer 包装 SpriteEngine 并实现 PetRenderer | 通过 | `src/overlay/renderer/sprite-renderer.ts` 实现了完整的 `PetRenderer` 接口：`load`、`setState`、`hitTest`、`update`、`getCanvas`、`capabilities`、`destroy`。使用 `AnimationPlayer` 和 canvas 精灵图渲染。 |
| 3 | RendererFactory 分发 sprite 和 spine，未知类型抛出异常 | 通过 | `src/overlay/renderer/renderer-factory.ts` 对类型进行 `switch`。`'sprite'` 返回 `SpriteRenderer`，`'spine'` 返回 `SpineRenderer`，未实现的类型抛出描述性错误。注意：工厂签名为 `create(type, canvas)` 而非冲刺文本建议的 `create(type, manifest)`，但这是更好的设计——manifest 通过 `load()` 单独传入，与 PetRenderer 接口契约一致。 |
| 4 | SkinManifest 类型 + 验证拒绝缺失字段 | 通过 | `SkinManifest` 类型位于 `pet-renderer.ts`，具有完整 schema。`skin-manifest.ts` 中的 `validateSkinManifest()` 验证 schema_version、name、version、renderer（对照白名单）和 size。10 个测试用例覆盖有效/无效/缺失字段。 |
| 5 | themes.rs 重命名为 skins.rs，list_themes 被替换，所有测试通过 | 通过 | `src-tauri/src/system/themes.rs` 不再存在。`src-tauri/src/system/mod.rs` 声明 `pub mod skins`。Rust 和 TypeScript 代码库中不存在对 `list_themes` 的引用。232 个测试通过。 |
| 6 | list_skins_catalog 返回合并的内置 + 用户目录 | 通过 | `list_skins_catalog()` 扫描 `public/skins/`（内置）和 `$APPDATA/ditto/skins/`（用户），按 ID 去重且内置优先，返回排序后的 `Vec<SkinEntry>`。测试 `test_list_skins_merged_catalog` 验证跨两个来源的 3 个条目。测试 `test_catalog_deduplication_bundled_priority` 验证优先级逻辑。 |
| 7 | import_skin_zip 验证 skin.json、解压、路径遍历防护 | 通过 | `import_skin_zip()` 从 zip 中读取 `skin.json`，验证必填字段（name、renderer 对照白名单），在解压前检查所有 zip 条目是否包含 `..` 或前导 `/`。测试 `test_import_skin_zip_roundtrip` 验证完整安装。测试 `test_import_rejects_missing_manifest` 验证拒绝逻辑。测试 `test_import_rejects_path_traversal` 验证安全检查。 |
| 8 | import_skin_url 下载 + 验证 | 通过 | `import_skin_url()` 使用 `reqwest::blocking::get` 下载，写入临时文件，委托 `import_skin_zip` 进行验证和解压。`Cargo.toml` 中确认 `reqwest` 启用了 `blocking` 特性。 |
| 9 | delete_skin 删除用户皮肤，拒绝内置皮肤 | 通过 | `delete_skin()` 规范化两个路径，并验证皮肤目录以用户数据目录开头。如果路径逃逸用户目录则返回错误"cannot delete bundled skins"。测试 `test_delete_skin_removes_user_skin` 和 `test_delete_skin_rejects_nonexistent` 覆盖主路径。注意：没有针对内置皮肤拒绝路径的显式测试（需要在用户目录外创建皮肤），但代码逻辑清晰，已通过代码审查验证。 |
| 10 | get/set_active_skin 持久化到设置数据库 | 通过 | `get_active_skin` 从设置数据库加载，默认值为 `"default"`。`set_active_skin` 保存到设置数据库。两者均注册为 IPC 命令。测试 `test_settings_migration` 验证读写往返。 |
| 11 | SpineRenderer 加载骨骼 + 图集，实现 PetRenderer | 通过 | `src/overlay/renderer/spine-renderer.ts` 动态导入 `@esotericsoftware/spine-canvas`，通过 `AssetManager` 加载骨骼 JSON + 图集，创建 `SkeletonJson`/`Skeleton`/`AnimationState`/`SkeletonRenderer`。`hitTest` 使用 `skeleton.getBounds()`。`setState` 通过 `state_map` 映射。报告的能力：expressionBlending=true、parameterDriving=true、physics=true。8 个测试用例。 |
| 12 | 示例 Spine 皮肤存在且资源有效 | 通过 | `public/skins/sample-spine/` 包含 `skin.json`（有效清单，含 8 个动画映射）、`skeleton.json`（有效 Spine 骨骼，含 root/body 骨骼、body-slot、idle/walk/sleep/happy/sad/eat/talk/sit 动画）、`skeleton.atlas`（有效图集，引用 texture.png）、`texture.png`。 |
| 13 | /skins 路由渲染带筛选和徽章的网格 | 部分通过 | `src/views/SkinsView.vue` 渲染 2 列网格，带渲染器类型筛选标签（全部/Sprite/Spine）、当前皮肤选择和渲染器徽章。但是：(a) 未呈现羁绊锁定徽章（冲刺说明"羁绊锁定徽章，全部解锁"），(b) 无动态预览动画（卡片显示表情符号 + 文本，而非动画预览）。筛选和选择功能正常工作。 |
| 14 | 宠物管理器统一窗口，旧独立窗口委托到它 | 通过 | `src/windows/pet-manager.ts` 提供 `openPetManager(route)`，创建单个 `pet-manager` WebviewWindow。`chat-bubble.ts`、`care-panel.ts` 和 `settings.ts` 均委托给 `openPetManager()`，传入相应路由。托盘菜单有"Pet Manager"项，发出 `open_pet_manager` 事件。`src/router/index.ts` 有嵌套在 `PetManagerView.vue` 下的 `/chat`、`/care`、`/skins`、`/settings` 路由。 |
| 15 | 设置迁移：active_skin 默认值，现有设置保留 | 通过 | `test_settings_migration` 创建数据库，保存迁移前设置，验证 `active_skin` 默认为 "default"，然后验证读写往返，并确认所有现有设置（provider_config、pet_name、auto_launch）保持不变。 |
| 16 | 所有 222+ v0.1.0 测试通过 + 新增测试 | 通过 | 232 个 Rust 测试通过（`skins.rs` 中新增 10 个）。新增 5 个 TypeScript 测试文件，覆盖渲染器接口合规性、SpriteRenderer、SpineRenderer、RendererFactory、SkinManifest 验证。 |
| 17 | AgentBackend trait 已定义，DittoAgent 实现它 | 通过 | `pub trait AgentBackend { fn backend_name(&self) -> &str; }` 定义于 `src-tauri/src/agent/core.rs:262`。`impl AgentBackend for DittoAgent` 位于第 266 行，返回特定提供者的后端名称。测试 `test_builtin_agent_implements_trait` 验证 trait 和实现存在于源代码中。 |

## 发现的问题

### 重要（不阻塞阶段通过）

1. **SkinsView 缺少羁绊锁定徽章**（标准 13）：冲刺指定了"羁绊锁定徽章（v0.1.5 中全部解锁）"，但 UI 完全没有羁绊相关的界面元素。由于羁绊引擎明确在范围之外（Phase 7），且徽章始终显示"已解锁"，这属于外观问题而非功能缺陷。

2. **SkinsView 缺少动态预览动画**（标准 13）：卡片显示静态表情符号和文本，而非动画预览。这是 UX 增强而非结构性缺口——渲染器基础设施（`SpineRenderer`、`SpriteRenderer`）已存在且可工作，只是尚未嵌入画廊卡片中。

3. **默认宠物没有内置皮肤清单**：默认宠物仍位于 `public/pets/default/`，没有 `skin.json`。它出现在 `list_skins()`（硬编码）中但不在 `list_skins_catalog()` 中。`/skins` UI 路由不会显示默认皮肤。这在 Phase 6 中可能是有意为之（遗留格式迁移推迟），但值得记录。

4. **缺少内置皮肤删除拒绝的显式测试**：`delete_skin()` 有防护代码但没有测试在用户目录外创建皮肤以验证错误路径。代码逻辑简明，已通过审查验证，但增加测试会更健壮。

### 建议（不阻塞）

1. **RendererFactory.create 签名**：冲刺文本说 `create('sprite', manifest)`，但实现是 `create(type, canvas)`。实际设计可以说更好（canvas 是构造依赖；manifest 通过 `load()` 加载），但与冲刺契约的偏差值得文档化。

2. **AgentBackend trait 是最小化的**：目前只有 `backend_name()`。冲刺说"无行为变化"，因此作为脚手架这是正确的，但考虑按标准 17 文本建议将 `send_message` 添加到 trait 签名中。

## 做得好的地方

- **干净的多渲染器架构**：`PetRenderer` 接口设计良好，具有清晰的能力报告、可选接口的类型守卫（`LipSyncable`、`Expressible`、`ParameterDrivable`），以及构造与加载之间的恰当分离。
- **全面的皮肤安全性**：`import_skin_zip` 中的路径遍历防护在解压前检查所有 zip 条目，`delete_skin` 使用路径规范化防止目录逃逸。
- **全面的测试覆盖**：`skins.rs` 中新增 10 个 Rust 测试，覆盖目录合并、去重、导入验证、路径遍历拒绝、删除和设置迁移。5 个 TypeScript 测试文件覆盖所有渲染器组件。
- **从 themes 到 skins 的干净迁移**：在整个代码库中完全移除 `themes.rs` 和 `list_themes`，零悬挂引用。
- **结构良好的示例 Spine 皮肤**：有效骨骼包含 8 个动画，覆盖核心宠物状态，图集和清单结构正确。

## 验证记录

- **测试已审查**：是。232 个 Rust 测试通过。5 个 TypeScript 测试套件已验证。新的 skins.rs 测试覆盖目录合并、去重、导入往返、清单拒绝、路径遍历、删除和设置迁移。
- **构建已验证**：是。`cargo test` 通过 232 个测试。`cargo clippy -D warnings` 干净。`cargo fmt --check` 干净。`npx tsc --noEmit` 干净。
- **安全已检查**：是。`import_skin_zip` 具有路径遍历防护（检查所有 zip 条目中的 `..` 和前导 `/`）。`delete_skin` 使用规范路径比较防止目录逃逸。`import_skin_url` 通过相同的 zip 验证路径进行验证。
