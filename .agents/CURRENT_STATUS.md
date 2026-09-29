# Current status

**State:** first usable version complete and verified end to end. Remediated
2026-09-29: the Workbench previously mounted no component at all in its wide
layout and its width knob moved only a status number — both faults are fixed
and covered by tests. `Autocomplete` is implemented.

Last verified with: Bun 1.4.0, TypeScript 5.9.3, `@opentui/react` 0.5.12,
`@opentui/core` 0.5.12, React 19.3.0, biome 2.5.14. The registry validator runs
the real `shadcn` CLI (`npx shadcn@latest`), so its version is whatever the
registry resolves at run time.

## Verification results

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `bun run typecheck` | pass |
| Lint / format | `bun run lint` | pass |
| Unit + interaction | `bun run test` | 134 pass, 6 files |
| Everything bare `bun test` discovers | `bun test` | 208 pass, 8 files (adds the visual suite and the generated clean-consumer fixture) |
| Visual regression | `bun run test:visual` | 73 pass, 70 golden fixtures |
| Registry schema | `bun run registry:validate` | 14 items / 27 files, accepted by the real `shadcn` CLI |
| Clean consumers | `bun run consumer:verify:all` | 14/14 install, typecheck, render |
| Workbench | `bun run workbench` | launches and renders at 40–160 columns; the live pane mounts in both layouts |

Everything is verified by execution, not by inspection alone: the Workbench was
captured from a real pty, and the clean-consumer fixtures typecheck and render
in throwaway projects with no dependency on this repository.

## The vertical slice

The spec asks for the full chain to be proven before breadth. It is, for every
component rather than just the reference one:

```text
component → primitives/theme → OpenTUI rendering → keyboard interaction
          → Workbench scenario → deterministic test
          → shadcn registry install → clean consumer render
```

`Select` was built first; `Autocomplete` is the most recent component through
the chain. The same chain is verified for all 14 registry items by
`bun run consumer:verify:all`.

## Deliberate deviations

1. **One install root for the registry, not the shadcn-idiomatic
   `@ui/` + `@lib/` split.** shadcn does not rewrite relative imports, so
   splitting directories would break every cross-directory import. Everything
   lands under `@components/terminal-ui/`. The trade and its verification are
   documented in `docs/registry.md`.

2. **Workbench chrome is outside the library.** The explorer uses plain boxes
   and its own `txt()` helper rather than the rail grammar, because the rail is
   the subject under inspection. What sits *inside* the live pane is the
   production tree, mounted inside the library's `FrameProvider` (so an animated
   scenario actually animates) and `SimulatedWidthProvider` (so the width knob
   reaches `useAvailableWidth` inside the component).

3. **Scenario definitions live in the library, not the Workbench.** They have
   to be importable by the visual suite for the "one definition" property to
   hold.

## Next

- The full-application components listed in the specification (`Tree`, `Table`,
  `Tabs`, `SplitPane`, `CommandPalette`, `Inspector`, `DataList`, `Timeline`,
  `ActivityFeed`, `Diff`, `CodeBlock`, `Markdown viewer`, `Form`, `Wizard`).
  The architecture does not make them awkward; see `docs/architecture.md`.
- A website consuming deterministic framebuffer captures from the real renderer,
  if one is ever wanted.
