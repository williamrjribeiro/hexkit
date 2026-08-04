# `@hexkit/core`

Generation orchestrator for Hexkit. It loads plugins, coordinates the generation
lifecycle, and manages generated files without containing framework-specific
logic.

This package connects the CLI to the plugin pipeline and provides the central
execution flow for turning an OpenAPI contract into an application.

`runPipeline` is asynchronous and awaits plugins strictly in declaration order.
The same in-memory artifact registry is shared for the duration of one run and
is never reused across runs.
