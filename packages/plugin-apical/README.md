# `@hexkit/plugin-apical`

Apical TS integration for Hexkit. Transforms OpenAPI 3.1 specifications into
generated contracts, Zod schemas, and operation definitions via Craft.

This plugin establishes the authoritative contract layer consumed by the
architecture and adapter generators.

After Craft succeeds, the plugin validates and bundles the OpenAPI document,
verifies schema and operation modules from Craft's TypeScript indexes, publishes
`APICAL_CONTRACT_ARTIFACT`, and writes the auditable
`src/generated/contracts/hexkit-contract.json` manifest. Tests can inject Craft,
OpenAPI loading, and generated-file reads through `ApicalPluginOptions`.

Craft emits a schema module for every component schema used by the contract,
including nested types that never become database tables. Persistence markers
such as `x-hexkit.persistence` are recorded on the contract artifact for later
plugins; they do not change whether a craft schema module is generated.

`@hexkit/plugin-apical/testing` exports library-shaped random contracts
(`createSeededLibraryContract`). In-memory `GenerationContext` collection lives
in `@hexkit/shared/testing`.
