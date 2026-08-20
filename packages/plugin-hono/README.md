# `@hexkit/plugin-hono`

Hono HTTP adapter generator for Hexkit. It produces route registration,
controllers, middleware wiring, and integration with Apical-generated
operations **discovered from the input contract**.

This plugin exposes the generated application through HTTP while keeping Hono
outside the application core. It must not hardcode sample operationIds or
Petstore paths; dogfood and Library fixtures may drive tests, not the generator
implementation (see PRD §5.0). Nested JSON request and response bodies follow
the Apical maps; no extra mapping is required for object, array, or `$ref`
payloads.
