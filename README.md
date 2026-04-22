# Ditto

**A living companion on your desktop, powered by AI.**

Ditto is an agent-driven desktop pet built with [Rust](https://www.rust-lang.org/) and [Tauri v2](https://v2.tauri.app/). A small animated creature lives on your desktop — walking, climbing, sleeping, and playing. Unlike scripted desktop pets, Ditto's behavior is governed by an AI agent that can hold conversations, perceive your screen, remember past interactions, and develop a personality over time.

## Features

- **Desktop Pet** — Transparent overlay, sprite animation, multi-monitor support
- **AI Agent** — Chat with your pet via natural language; powered by cloud or local LLMs
- **Personality Engine** — Traits that evolve based on your interactions over time
- **Memory System** — Your pet remembers you across sessions
- **Screen Awareness** — Pet can see your screen and comment on what you're doing
- **Care System** — Hunger, happiness, energy, and social needs with mood-driven behavior
- **Multi-Provider LLM** — Cloud (OpenAI, Anthropic) + local (Ollama) with automatic fallback

## Status

Ditto is in **early development** (v0.0.1). The PRD and implementation harness are complete. See [docs/PRD.md](docs/PRD.md) for the full product specification.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App framework | Tauri v2 |
| Backend | Rust |
| Frontend | Canvas 2D + SolidJS (or Vanilla TS) |
| AI Agent | rig-core |
| Local LLM | Ollama |
| Database | SQLite (via rusqlite) |

## Project Structure

```
ditto/
├── src-tauri/          # Rust backend (Tauri app)
├── src/                # Frontend (web)
├── assets/             # Sprites, sounds, themes
├── docs/               # PRD, specs, plans
├── ditto-harness/      # Long-running implementation harness state
└── .claude/commands/   # Claude Code skills (ditto-implement)
```

## Development

Prerequisites:
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- [Tauri v2 CLI](https://v2.tauri.app/start/prerequisites/)

```bash
# Install dependencies
npm install

# Run in development mode
cargo tauri dev

# Run tests
cargo test --manifest-path src-tauri/Cargo.toml

# Build for production
cargo tauri build
```

## Implementation Harness

Ditto uses a long-running TDD harness for phased development. Run the harness skill with Claude Code:

```
/ditto-implement
```

See [docs/superpowers/specs/2026-04-22-ditto-harness-skill-design.md](docs/superpowers/specs/2026-04-22-ditto-harness-skill-design.md) for the harness design.

## Roadmap

| Phase | Goal | Status |
|-------|------|--------|
| 1 — Skeleton | Pet on screen with transparent window | Planned |
| 2 — Life | Movement, interaction, physics | Planned |
| 3 — Mind | AI agent, chat, memory | Planned |
| 4 — Soul | Care system, screen awareness | Planned |
| 5 — Polish | System tray, settings, packaging | Planned |

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
