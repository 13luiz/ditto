name: Feature Request
description: Suggest a new feature or enhancement
labels: ["enhancement"]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for suggesting a feature! Please check the [PRD](docs/PRD.md) first to see if it's already planned.
  - type: textarea
    id: problem
    attributes:
      label: Problem / Motivation
      description: What problem does this feature solve?
      placeholder: "I'm always frustrated when..."
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: How would you like this to work?
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: Any alternative solutions or features you've considered.
    validations:
      required: false
  - type: dropdown
    id: prd-section
    attributes:
      label: PRD Reference
      description: Which PRD section is this related to?
      options:
        - Not in PRD (new idea)
        - Phase 1 — Skeleton
        - Phase 2 — Life
        - Phase 3 — Mind
        - Phase 4 — Soul
        - Phase 5 — Polish
        - Extensibility (Nice-to-Have)
    validations:
      required: true
  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Mockups, references, or any other context.
    validations:
      required: false
