# Ditto

**A living companion on your desktop, powered by AI.**

Ditto is an agent-driven desktop pet built with [Rust](https://www.rust-lang.org/) and [Tauri v2](https://v2.tauri.app/). A small animated creature lives on your desktop — walking, falling, and playing. Unlike scripted desktop pets, Ditto's behavior is governed by an AI agent that can hold conversations, perceive your screen, remember past interactions, and develop a personality over time.

## Features

- **Desktop Pet** — Transparent overlay, sprite animation, multi-monitor support
- **Movement & Physics** — Autonomous wandering, gravity simulation, screen boundary detection
- **Grab & Drag** — Pick up and move your pet; it falls when released
- **Cursor Interaction** — Pet notices when your cursor is nearby
- **AI Agent** — Chat with your pet via natural language; powered by cloud or local LLMs (planned)
- **Personality Engine** — Traits that evolve based on your interactions over time (planned)
- **Memory System** — Your pet remembers you across sessions (planned)
- **Care System** — Hunger, happiness, energy, and social needs with mood-driven behavior (planned)

## Status

Ditto is in **early development**. Phases 1 (Skeleton) and 2 (Life) are complete — the pet renders on a transparent window, walks autonomously, reacts to your cursor, and can be grabbed and dragged. See [CHANGELOG.md](CHANGELOG.md) for details.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App framework | Tauri v2 |
| Backend | Rust |
| Frontend | Canvas 2D + TypeScript |
| AI Agent | rig-core (planned) |
| Database | SQLite via rusqlite (planned) |

## Project Structure

```
ditto/
├── src-tauri/
│   ├── src/
│   │   ├── behavior/      # FSM, physics, cursor detection
│   │   └── commands/      # Tauri IPC commands
│   └── capabilities/      # Tauri v2 permissions
├── src/
│   ├── behavior/          # PetController (state, movement)
│   ├── renderer/          # SpriteEngine, AnimationPlayer
│   └── input/             # Click-through, drag handler
├── assets/pets/default/   # Spritesheet + animation definitions
├── docs/                  # PRD, specs
└── ditto-harness/         # TDD implementation harness state
```

## Development

Prerequisites:
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- [Tauri v2 CLI](https://v2.tauri.app/start/prerequisites/)

```bash
npm install
npx tauri dev
```

```bash
# Run tests
cargo test --manifest-path src-tauri/Cargo.toml

# Run a single test
cargo test --manifest-path src-tauri/Cargo.toml <test_name>

# Lint
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# Format
cargo fmt --manifest-path src-tauri/Cargo.toml
```

## Roadmap

| Phase | Goal | Status |
|-------|------|--------|
| 1 — Skeleton | Pet on screen with transparent window | Done |
| 2 — Life | Movement, interaction, physics | Done |
| 3 — Mind | AI agent, chat, memory | Planned |
| 4 — Soul | Care system, screen awareness | Planned |
| 5 — Polish | System tray, settings, packaging | Planned |

## Implementation Harness

Ditto uses a long-running TDD harness for phased development. Run the harness skill with Claude Code:

```
/ditto-implement
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgements

- [Tauri](https://tauri.app/) — Cross-platform app framework
- [rig-core](https://github.com/0xPlaygrounds/rig) — Rust AI agent framework
- [Bongo Cat](https://github.com/ayangweb/bongocat) — Desktop pet with Tauri
- [VPet-Simulator](https://github.com/LorisYounger/VPet) — Feature-rich desktop pet
- [CrabNebula Tutorial](https://crabnebula.dev/blog/building-a-desktop-pet-with-tauri/) — Tauri desktop pet guide

---

**[中文文档](README.zh.md)**
