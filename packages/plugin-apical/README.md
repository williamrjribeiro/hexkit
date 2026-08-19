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
