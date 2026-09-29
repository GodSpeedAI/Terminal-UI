# Current status

**State:** first usable version complete and verified end to end.

Last verified with: Bun 1.4.0, TypeScript 5.9.3, `@opentui/react` 0.5.12,
`@opentui/core` 0.5.12, React 19.3.0, `shadcn` 4.21.0.

## Verification results

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `bun run typecheck` | pass |
| Lint / format | `bun run lint` | pass (biome 2.5) |
| Unit + interaction | `bun test` | 173 pass |
| Visual regression | `bun run test:visual` | 68 pass, 64 golden fixtures |
| Registry schema | `bun run registry:validate` | 13 items, accepted by the real `shadcn` CLI |
| Clean consumers | `bun run consumer:verify:all` | 13/13 install, typecheck, render |
| Workbench | `bun run workbench` | launches and renders at 40–160 columns |

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

`Select` was built first, and the same chain is now verified for all 13 registry
items by `bun run consumer:verify:all`.

## Deliberate deviations

1. **`Autocomplete` is not implemented.** Type-ahead in `Select` covers the
   common case; a filtering overlay is a different interaction with its own state
   model. Listed as the next component rather than shipped as a stub — the spec
   forbids placeholder components pretending to be complete.

2. **One install root for the registry, not the shadcn-idiomatic
   `@ui/` + `@lib/` split.** shadcn does not rewrite relative imports, so
   splitting directories would break every cross-directory import. Everything
   lands under `@components/terminal-ui/`. The trade and its verification are
   documented in `docs/registry.md`.

3. **Workbench chrome is outside the library.** The explorer uses plain boxes and
   its own `txt()` helper rather than the rail grammar, because the rail is the
   subject under inspection.

4. **Scenario definitions live in the library, not the Workbench.** They have to
   be importable by the visual suite for the "one definition" property to hold.

## Next

- `Autocomplete`.
- The full-application components listed in the specification (`Tree`, `Table`,
  `Tabs`, `SplitPane`, `CommandPalette`, `Inspector`, `DataList`, `Timeline`,
  `ActivityFeed`, `Diff`, `CodeBlock`, `Markdown viewer`, `Form`, `Wizard`).
  The architecture does not make them awkward; see `docs/architecture.md`.
- A website consuming deterministic framebuffer captures from the real renderer,
  if one is ever wanted.
