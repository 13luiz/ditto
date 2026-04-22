name: Bug Report
description: Report a bug or unexpected behavior
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for reporting a bug! Please fill out the sections below.
  - type: textarea
    id: description
    attributes:
      label: Description
      description: A clear description of what the bug is.
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: How to reproduce the behavior.
      placeholder: |
        1. Start Ditto with `cargo tauri dev`
        2. Click on the pet
        3. ...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What you expected to happen.
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happened.
    validations:
      required: true
  - type: input
    id: os
    attributes:
      label: Operating System
      description: e.g., Windows 11, macOS 14
      placeholder: "Windows 11"
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: Ditto Version
      description: Version number or git commit hash
      placeholder: "v0.0.1 or abc1234"
    validations:
      required: false
  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Screenshots, logs, or any other context.
    validations:
      required: false
