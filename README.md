# pi-providers

Monorepo of Pi model provider extensions that are published but not in daily
use. Each package in `packages/` is published to npm on its own.

## Packages

| Package | Description |
|---|---|
| [`@aliou/pi-cohere`](packages/cohere) | Cohere provider |
| [`@aliou/pi-edgee`](packages/edgee) | Edgee AI gateway provider |
| [`@aliou/pi-poolside`](packages/poolside) | Poolside provider |

## Development

```sh
pnpm install
pnpm -r typecheck
pnpm -r test
```

## Adding a provider

Scaffold a new package under `packages/<name>/` (see `packages/cohere` for the
shape). The package keeps its own `@aliou/pi-<name>` npm name and version.

Versioning uses [changesets](https://github.com/changesets/changesets) in
independent mode at the root: `pnpm changeset` to record a change,
`pnpm version` to bump versions and update CHANGELOGs, `pnpm release` to
publish changed packages to npm.
