# Task 4 Report — Drizzle BlobStore and metadata insert

## Status

Implemented the default Drizzle `BlobStore`, conditional `hexkit_blobs`
migration, and binary-upload metadata persistence for the domain-agnostic
`upload-api` fixture.

## TDD evidence

### RED

Added two fixture-driven tests in
`packages/plugin-drizzle/src/plugin.test.ts`, committed as `ee68123`:

1. BlobStore adapter and `hexkit_blobs` migration emission.
2. Metadata insert with parent lookup, optional query metadata, aggregate
   return, and no binary repository argument.

After rebuilding workspace packages, `vp run --filter
@hexkit/plugin-drizzle test` failed exactly those two tests:

- Adapter lookup returned an empty string because no
  `src/adapters/persistence/drizzle-blob-store.ts` was generated.
- The repository still emitted `.values(storageKey)` and had no parent lookup.

Result: 2 failed, 71 passed.

### GREEN

Implemented the adapter and metadata insert, committed as `856c470`. Rebuilt
workspace packages and reran the same focused suite.

Result: 10 test files passed; 73 tests passed.

## Implementation

- Emits `src/adapters/persistence/drizzle-blob-store.ts` only when the
  hexagonal artifact has a `blobStorePort`.
- Defines `hexkit_blobs` with a text primary key and `bytea` content using
  Drizzle buffer mode.
- Implements UUID-backed `put`, byte-preserving `get`, and boolean `delete`.
- Adds the infra table to the generated SQL migration only for BlobStore apps.
- Detects binary-upload repository methods from the octet-stream contract
  operation.
- Checks referenced parents before metadata insertion and returns `undefined`
  for contracts with a 404 result.
- Inserts path/query columns plus `storageKey`; optional query values are
  omitted when undefined.
- Returns the persisted aggregate so the hexagonal use case can produce the
  receipt stub.
- Uses UUIDs for text metadata identities and generated Postgres identities
  for integer metadata identities.
- Keeps domain columns free of `bytea`.

## Verification

- `vp run --filter './packages/*' --filter './apps/cli' build`: passed for all
  11 projects.
- `vp check`: all 278 files formatted; no warnings, lint errors, or type errors
  across 207 checked files.
- `vp run --filter './packages/*' --filter './apps/cli' test`: all package and
  CLI suites passed (488 tests).
- Focused Drizzle suite: 10 files and 73 tests passed.

## Concerns

None.
