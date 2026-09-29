# Registry and source distribution

The registry is a first-class distribution channel, not a packaging detail. The
requirement is that a user can install one component as editable source and own
it, without installing this library and without any file reaching back into
something that was never published.

## Install

```bash
bunx shadcn@latest add terminal-ui/terminal-ui/select
```

`select` pulls its dependencies transitively:

```text
select → prompt, hooks, primitives, utils, theme
```

Those land under your components directory, preserving their relative layout:

```text
components/terminal-ui/
  components/prompt/prompt.tsx
  components/select/select.tsx
  hooks/use-prompt-keys.ts
  primitives/rail.tsx
  theme/clack.ts
  utils/style.ts
  ...
```

You then import by path and edit freely:

```tsx
import { Select, type SelectOption } from "@/terminal-ui/components/select/select.js";
import { ThemeProvider } from "@/terminal-ui/theme/index.js";
```

Wiring a real consumer is exactly what `fixtures/clean-consumer` does.

## The registry is generated, never hand-written

```bash
bun run registry:build
```

`scripts/build-registry.ts` derives `registry.json` from the source tree. Two
reasons:

1. **Dependency drift.** A hand-maintained `registryDependencies` list is a
   claim about the import graph, and claims rot. Here it is *computed* from the
   actual `import` statements, so a component cannot be published without
   something it imports; the same derivation emits each item's npm
   `dependencies` (see above). (This is not hypothetical: the first
   implementation
   appended `.ts` to specifiers that already ended in `.js`, resolved nothing,
   and produced a registry where every component declared no dependencies at
   all. The failure is silent — the file is well-formed.)

2. **One implementation.** `files[].path` points at the same files the package
   and the Workbench import. There is no copy step and no second version to
   keep in sync. Editing `src/components/select/select.tsx` changes the package,
   the Workbench, and the registry item simultaneously.

## Why every file lives under one root

shadcn does not rewrite relative imports. The sources use relative imports
between themselves (`../../theme/context.js`), so the installed files have to
keep the same relative relationships.

Splitting them across `@ui/`, `@lib/`, and `@components/` — the shadcn-idiomatic
layout — would break every cross-directory import, because those placeholders
resolve to different directories. So everything lands under a single
`@components/terminal-ui/` root with the repo-relative path intact:

```text
@components/terminal-ui/components/select/select.tsx
@components/terminal-ui/theme/context.ts
@components/terminal-ui/primitives/rail.tsx
```

The consequence is that `@ui/` and `@lib/` are unused. That is a deliberate
trade: a slightly unusual directory layout in exchange for copied source that
provably resolves its own imports. `bun run registry:validate` asserts the
single-root property so it cannot be broken by accident.

## Items

| Item | Type | Contents |
| --- | --- | --- |
| `theme` | `registry:ui` | state vocabulary, `defineTheme`, the three themes, `ThemeProvider` |
| `utils` | `registry:lib` | cell-width arithmetic, theme→OpenTUI style bridge |
| `primitives` | `registry:ui` | `Rail`, `RailRow`, `Marker`, `Status`, `Label`, `Hint`, `Separator` |
| `hooks` | `registry:hook` | `usePromptState`, `usePromptKeys`, hint builders, width resolution |
| `prompt` | `registry:component` | the prompt shell |
| `select` | `registry:component` | single-choice list |
| `autocomplete` | `registry:component` | filtering combobox |
| `multiselect` | `registry:component` | multiple-choice list |
| `text-input` | `registry:component` | text field + `PasswordInput` |
| `confirm` | `registry:component` | two-way choice |
| `note` | `registry:component` | framed aside |
| `composition` | `registry:component` | `Log`, `Intro`, `Outro`, `Cancel` |
| `feedback` | `registry:component` | `Spinner`, `Progress`, `FrameProvider` |
| `task` | `registry:component` | `Task`, `TaskList`, `Group`, `PromptGroup` |

Every file belongs to exactly one item. That keeps the graph a tree rather than
a mesh, and it is why an item's dependencies are exactly "the items that own the
files it imports".

## Per-item npm dependencies

Each item also carries a `dependencies` array of npm spec strings —
`["@opentui/core@>=0.5.0", "react@>=19.2.0"]` — derived the same way as
`registryDependencies`: every bare specifier the item's files import, annotated
with the version range the root `package.json` declares for it. That is what
lets `shadcn add` make sure the consumer actually has what the copied source
imports, and a specifier with no peer entry fails the build rather than being
omitted silently.

The field is an **array of spec strings**, not a `specifier -> range` map: the
shadcn item schema defines `dependencies` as `Array<string>`, and the real CLI
rejects the map form (`dependencies: Expected array, received object`). A spec
string is also exactly what `shadcn add` hands to the package manager. An item
that imports nothing from npm omits the field entirely (`composition`).

One accepted blind spot: the derivation parses source `import` statements,
which cannot see the `jsx-runtime` import the compiler injects, so `.tsx` items
understate `@opentui/react`. That is harmless — anything rendering these
components already runs `@opentui/react`.

## Validation

```bash
bun run registry:validate
```

Two layers, in this order.

**1. The real shadcn CLI.** `shadcn registry validate` from the actual shadcn
package. Re-implementing a schema validator when the upstream tool exists would
mean our definition of "valid" could drift from the CLI that has to consume the
file. If the CLI is unavailable (offline) that is reported, not silently
ignored.

This check is not decorative: the current schema requires `items` to be an
**array**. The older keyed-object form — which is what most registries and most
LLM-written examples use — is rejected.

**2. What the CLI cannot check.** The CLI validates the manifest's shape. It
cannot know whether:

- every declared file exists on disk,
- every file belongs to exactly one item,
- every `registryDependency` names a real item,
- the graph is acyclic,
- **declared dependencies match the real import graph**,
- **no published file imports something the registry never installs**,
- all targets share one install root.

The last three are the ones that produce a registry which validates and does not
work. They are checked by re-parsing the import graph and diffing it against the
manifest.

## Clean consumer verification

A valid registry is not a working registry. `registry:validate` cannot tell you
whether a copied component still typechecks, still resolves its imports, or
depends on something unpublished. So:

```bash
bun run consumer:verify -- select     # one item
bun run consumer:verify:all           # every item
```

`scripts/verify-clean-consumer.ts` does the real thing:

1. Creates a throwaway project with **no dependency on this repository**.
2. Resolves the item's transitive `registryDependencies` from the manifest.
3. Copies files exactly as shadcn would, honouring `files[].target`.
4. **Rejects any copied file that imports outside the installed tree** — this is
   the check that catches a component quietly importing a private module.
5. Typechecks against only its declared peer dependencies.
6. Renders it in OpenTUI's test renderer and asserts the exact characters.

`scripts/consumer-fixtures.ts` supplies a realistic consumer per item — the
imports someone would actually write, and the exact output the reference grammar
says to expect. Verifying only `select` would leave every other item's public
surface untested, and a registry entry with a wrong export is precisely the
break this suite exists to catch.

Current status: **14/14 items install, typecheck, and render.**

## The fixture is generated, not committed

`fixtures/clean-consumer/` is in `.gitignore`. It is rebuilt from the registry
on every run, so committing it would only ever be a stale copy that disagrees
with the source it came from.

## Adding a component

1. Write it under `src/components/<name>/<name>.tsx`, importing from the layers
   below via relative paths.
2. Add scenarios to `src/scenario/catalog.tsx`.
3. Add the item to `COMPONENT_FILES` in `scripts/build-registry.ts` and a
   consumer fixture to `scripts/consumer-fixtures.ts`.
4. `bun run registry:build && bun run registry:validate && bun run consumer:verify:all`

Step 3 is short because the dependency graph is derived. If your component
imports something new inside the repository, the builder notices and declares
the dependency; the validator then fails if you forgot to publish the thing you
imported.
