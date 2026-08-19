# `@hexkit/plugin-sst`

SST infrastructure generator for Hexkit ( **deferred post-PoC** ).

This package is a **scaffold only** — `src/index.ts` exports an empty module.
PoC packaging is emitted by `@hexkit/cli` (Docker Compose for Hono or Next +
Postgres). Live AWS Lambda / SST synthesis is explicitly out of PoC scope; see
[PRD.md](../../PRD.md) §3.4.

When implemented, this plugin will produce deployment configuration for AWS
Lambda, API Gateway integration, and environment handling without introducing
infrastructure concerns into the application core.
