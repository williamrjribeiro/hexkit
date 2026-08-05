# Task 2 Report: Wire security into ContractArtifact + Apical golden parity

## Status

Implemented and pushed on `cursor/openapi-auth-plan-d625`.

## Changes

- Added required `securitySchemes` and `globalSecurity` fields to `ContractArtifact`.
- Added required `security` field to every `ContractOperation`.
- Wired `normalizeContractArtifact` through Task 1 helpers:
  - `normalizeSecuritySchemes(document)`
  - `normalizeGlobalSecurity(document)`
  - `resolveOperationSecurity(document, operation, schemes, globalSecurity)`
- Added BDD-style integration coverage for auth fixture normalization.
- Added Apical golden parity coverage by running craft against `apps/fixtures/auth-api/openapi.yaml` and comparing each operation's `security.apicalServerHeaderNames` to parsed `*ServerHeadersSchema` object keys.
- Updated auth-free test fixtures with empty security metadata.
- Ran formatter for two pre-existing OpenAPI auth docs that blocked `vp check`.

## TDD Evidence

### RED

Command:

```sh
. "$HOME/.vite-plus/env" && vp run @hexkit/plugin-api#build && vp test run packages/plugin-apical/src/contract/security.test.ts
```

Result:

```text
packages/plugin-apical/src/contract/security.test.ts (6 tests | 2 failed)

FAIL ... when auth OpenAPI is normalized, then artifact and operations expose security metadata
AssertionError: expected undefined to deeply equal [...]
expect(artifact.securitySchemes).toEqual([...])

FAIL ... when craft emits server header schemas, then IR apicalServerHeaderNames match schema keys
TypeError: Cannot read properties of undefined (reading 'apicalServerHeaderNames')
```

This failed for the intended missing production behavior: `ContractArtifact.securitySchemes` and `ContractOperation.security` were not emitted yet.

### GREEN

Command:

```sh
. "$HOME/.vite-plus/env" && vp test run packages/plugin-apical/src/contract/security.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests  6 passed (6)
```

## Final Verification

Command:

```sh
. "$HOME/.vite-plus/env" && vp test run packages/plugin-apical && vp test run packages/plugin-drizzle/src/plugin.test.ts && vp check
```

Result:

```text
Test Files  4 passed (4)
Tests  21 passed (21)

Test Files  1 passed (1)
Tests  6 passed (6)

pass: All 127 files are correctly formatted
pass: Found no warnings, lint errors, or type errors in 82 files
```

Not run per instruction: petstore Compose, dogfood, Pactum.

## Commits

- `10f11ff` `feat(plugin-apical): attach security metadata to contract artifact`
- `36a46a0` `style: format OpenAPI auth docs and tests`
- `ca4243c` `test(cli): add empty security to packaging fixtures`

## Concerns

- `vp check` initially exposed formatting issues in `docs/superpowers/plans/2026-08-05-openapi-auth.md` and `docs/superpowers/specs/2026-08-05-openapi-auth-design.md`; I formatted them in a separate style commit so the required check could pass.
- Focused downstream verification required building workspace `dist/` outputs first because workspace package exports point at ignored `dist/index.mjs` files.
