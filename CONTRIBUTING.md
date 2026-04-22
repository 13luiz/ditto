# Contributing to Ditto

Thank you for your interest in contributing to Ditto! This document provides guidelines for contributing.

## Development Setup

See [README.md](README.md) for prerequisites and setup instructions.

## How to Contribute

### Reporting Bugs

Open a [bug report issue](https://github.com/luiz-tb16p/ditto/issues/new?template=bug_report.md). Include:
- Steps to reproduce
- Expected vs actual behavior
- OS and version (Windows/macOS)
- App version or git commit

### Requesting Features

Open a [feature request issue](https://github.com/luiz-tb16p/ditto/issues/new?template=feature_request.md). Reference the [PRD](docs/PRD.md) if applicable.

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes with tests
4. Ensure all tests pass: `cargo test --manifest-path src-tauri/Cargo.toml`
5. Ensure code is formatted: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
6. Ensure no clippy warnings: `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
7. Commit with a descriptive message
8. Open a pull request

### Code Style

- Rust: Follow `rustfmt` defaults + `clippy` recommendations
- TypeScript: 2-space indent, semicolons, single quotes
- Commits: Use [Conventional Commits](https://www.conventionalcommits.org/) format

## Project Architecture

See [docs/PRD.md](docs/PRD.md) Section 4 for the full architecture overview.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
