# Ditto

**桌面上的活物伙伴，由 AI 驱动。**

Ditto 是一个基于 [Rust](https://www.rust-lang.org/) 和 [Tauri v2](https://v2.tauri.app/) 构建的智能桌面宠物。一只小小的动画生物生活在你的桌面上——行走、坠落、玩耍。与脚本驱动的桌面宠物不同，Ditto 的行为由 AI Agent 控制，可以对话、感知屏幕内容、记住历史互动，并逐渐形成独特的性格。

## 功能特性

- **桌面宠物** — 透明窗口叠加层、精灵动画、多显示器支持
- **运动与物理** — 自主漫游、重力模拟、屏幕边界检测
- **抓取与拖拽** — 拿起并移动宠物，松开后自然坠落
- **光标交互** — 宠物会注意到光标靠近
- **AI Agent** — 通过自然语言与宠物对话，支持云端或本地大模型（计划中）
- **性格引擎** — 基于互动逐渐演化的性格特征（计划中）
- **记忆系统** — 跨会话记住你的信息（计划中）
- **照料系统** — 饥饿、快乐、精力和社交需求，情绪驱动行为（计划中）

## 当前状态

Ditto 处于**早期开发阶段**。阶段 1（骨架）和阶段 2（生命）已完成——宠物可以在透明窗口上渲染、自主行走、响应光标、被抓取和拖拽。详见 [CHANGELOG.md](CHANGELOG.md)。

## 技术栈

| 层级 | 技术 |
|------|------|
| 应用框架 | Tauri v2 |
| 后端 | Rust |
| 前端 | Canvas 2D + TypeScript |
| AI Agent | rig-core（计划中） |
| 数据库 | SQLite via rusqlite（计划中） |

## 项目结构

```
ditto/
├── src-tauri/
│   ├── src/
│   │   ├── behavior/      # 有限状态机、物理引擎、光标检测
│   │   └── commands/      # Tauri IPC 命令
│   └── capabilities/      # Tauri v2 权限配置
├── src/
│   ├── behavior/          # PetController（状态、运动）
│   ├── renderer/          # SpriteEngine、AnimationPlayer
│   └── input/             # 点击穿透、拖拽处理
├── assets/pets/default/   # 精灵图 + 动画定义
├── docs/                  # PRD、规格文档
└── ditto-harness/         # TDD 实现脚手架状态
```

## 开发

前置条件：
- [Rust](https://www.rust-lang.org/tools/install)（最新稳定版）
- [Node.js](https://nodejs.org/)（v18+）
- [Tauri v2 CLI](https://v2.tauri.app/start/prerequisites/)

```bash
npm install
npx tauri dev
```

```bash
# 运行测试
cargo test --manifest-path src-tauri/Cargo.toml

# 运行单个测试
cargo test --manifest-path src-tauri/Cargo.toml <测试名称>

# 代码检查
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# 格式化
cargo fmt --manifest-path src-tauri/Cargo.toml
```

## 路线图

| 阶段 | 目标 | 状态 |
|------|------|------|
| 1 — 骨架 | 宠物在透明窗口中显示 | 已完成 |
| 2 — 生命 | 运动、交互、物理 | 已完成 |
| 3 — 思维 | AI Agent、对话、记忆 | 计划中 |
| 4 — 灵魂 | 照料系统、屏幕感知 | 计划中 |
| 5 — 打磨 | 系统托盘、设置、打包 | 计划中 |

## 实现脚手架

Ditto 使用长期运行的 TDD 脚手架进行分阶段开发。在 Claude Code 中运行脚手架技能：

```
/ditto-implement
```

## 贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

## 许可证

本项目采用 MIT 许可证——详见 [LICENSE](LICENSE)。

## 致谢

- [Tauri](https://tauri.app/) — 跨平台应用框架
- [rig-core](https://github.com/0xPlaygrounds/rig) — Rust AI Agent 框架
- [Bongo Cat](https://github.com/ayangweb/bongocat) — Tauri 桌面宠物
- [VPet-Simulator](https://github.com/LorisYounger/VPet) — 功能丰富的桌面宠物
- [CrabNebula 教程](https://crabnebula.dev/blog/building-a-desktop-pet-with-tauri/) — Tauri 桌面宠物指南

---

**[English](README.md)**
