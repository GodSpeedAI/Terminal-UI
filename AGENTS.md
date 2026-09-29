# AGENTS.md

## Mission

Build a native **OpenTUI React component library** that combines:

- Clack-inspired visual grammar,
- OpenTUI-native rendering and interaction,
- a native component Workbench,
- deterministic testing,
- shadcn-compatible source distribution.

This is a component library, not a Clack port, wrapper, application framework, browser UI system, or workflow engine.

## Architectural Invariants

### OpenTUI is the substrate

Production components render through OpenTUI.

Prefer:

- `@opentui/react`
- `@opentui/core`

Do not introduce DOM/browser runtime dependencies into the component library.

Verify current OpenTUI APIs before relying on behavior involving rendering, focus, input, layout, lifecycle, or testing.

### Preserve the visual grammar

The default design language is inspired by Clack:

- rail-oriented composition,
- semantic markers,
- restrained color,
- whitespace and indentation,
- clear active/completed/error transitions.

Do not drift toward generic box-heavy terminal dashboards.

Clack is a visual reference, not a runtime dependency.

### Semantics before presentation

Components express semantic state, not literal styling.

Prefer concepts such as:

- active
- pending
- complete
- selected
- error
- disabled

Colors, glyphs, and presentation tokens belong in themes.

Do not scatter hard-coded glyphs or colors through components.

### Compose shared primitives

Shared concerns such as rails, markers, labels, hints, status indicators, completion rendering, and validation presentation should be composed from reusable primitives.

Do not independently reimplement the same visual grammar inside each control.

### Explicit state models

Interactive components should use coherent state models rather than collections of overlapping booleans.

State transitions must be predictable and testable.

### Source ownership is first-class

The library must support both:

1. normal package imports, and
2. shadcn-compatible source installation.

Registry-installed components must not depend on hidden or unpublished internal modules.

Shared source dependencies should themselves be installable registry items.

There must be one implementation, not separate package and registry versions.

### Native Workbench

The primary component explorer is a native OpenTUI application.

Do not replace it with browser-rendered replicas.

Workbench scenarios should render the real production components.

### Deterministic verification

Use OpenTUI-native testing for rendering and interaction.

Tests should verify meaningful behavior, not merely implementation structure.

Visual tests must be deterministic.

Animations and timing-sensitive components must provide a deterministic test path.

## Development Strategy

Use a vertical slice before expanding breadth.

`Select` is the initial reference component.

Prove the complete path:

    component
      → primitives/theme
      → OpenTUI rendering
      → keyboard interaction
      → Workbench scenario
      → deterministic tests
      → shadcn registry installation
      → clean consumer render

Do not mass-produce components until this path works.

Prefer the smallest architecture that satisfies current requirements.

Do not introduce framework-scale abstractions without demonstrated need.

## Agent Protocol

Before changing code:

1. Read this file.
2. Inspect the relevant implementation and tests.
3. Identify the architectural boundary involved.
4. Verify external APIs when current OpenTUI or shadcn behavior matters.
5. Make the smallest coherent change.
6. Run focused verification.
7. Update affected documentation when behavior or architecture changes.

Do not rewrite working architecture simply because another structure is possible.

Understand existing decisions before replacing them.

## Verification Standard

A task is not complete because code exists.

Provide evidence appropriate to the change, such as:

- typecheck,
- tests,
- interaction execution,
- framebuffer/visual verification,
- Workbench inspection,
- registry validation,
- clean-consumer installation,
- package build.

For visual changes, inspect the rendered result.

For interaction changes, execute the interaction.

For registry changes, prove installation into a clean consumer.

## Subagent Use

For substantial work, use builder and independent verifier roles when available.

The verifier should receive:

- the original requirement,
- the builder instructions,
- the implementation,
- relevant tests.

Verification must identify:

- unmet requirements,
- deviations from instructions,
- architectural regressions,
- missing failure coverage,
- whether the evidence actually supports approval.

Approval requires evidence, not a superficial review.

If verification fails, repair and verify again.

## Stop Conditions

Surface the tradeoff before proceeding if a change would require:

- replacing OpenTUI as the rendering substrate,
- introducing browser/DOM dependencies into production components,
- abandoning semantic states for raw styling APIs,
- making registry components depend on unpublished internals,
- maintaining separate implementations for package and source-copy users,
- replacing the native Workbench with browser emulation,
- introducing a major framework or subsystem not justified by current requirements,
- materially changing the rail-oriented visual language.

## Definition of Done

A change is done when:

- behavior is implemented coherently,
- architectural invariants remain intact,
- relevant tests pass,
- the actual rendered/interacting behavior is verified,
- source-copy distribution still works when affected,
- documentation reflects meaningful architectural or behavioral changes.

## Anchor

**Build semantic, Clack-inspired OpenTUI components that developers can render natively, inspect, copy, own, compose, test, and extend.**

When uncertain, preserve that.