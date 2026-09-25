# pi-providers

Monorepo of published Pi model provider extensions that are not in daily use
(cohere, edgee, poolside, …). Single-purpose, low-maintenance packages.

## Layout

- `packages/<name>/` — one npm package per provider. Each keeps its own
  `@aliou/pi-<name>` name, version, `biome.json`, `tsconfig.json`, tests, and
  CHANGELOG.

## Conventions

- Root scripts fan out with `pnpm -r`. Run checks from the root.
- Shared dev tooling (pinning of `@earendil-works/pi-coding-agent`, building
  blocks) is managed in the root `package.json` / `pnpm-workspace.yaml`, not
  per package.
- Peer packages Pi injects at runtime (`@earendil-works/pi-ai`,
  `@earendil-works/pi-coding-agent`) are optional peers in each package, with
  exact dev versions for local checks.
- No per-package `shell.nix`, `.github/`, husky, or changesets. Add workspace
  CI at the root when packages change.
- Publishing: manual, per package, via `pnpm publish` from the package
  directory. Update the package CHANGELOG when cutting a release.

## Nix / shell

There is a single `shell.nix` and `.envrc` at the repo root.
