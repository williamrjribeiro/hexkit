# `@hexkit/plugin-api`

Plugin contracts and lifecycle definitions for Hexkit. It defines the interfaces,
metadata, and generation context shared by the core orchestrator and plugins.

This package is the stable boundary that lets Hexkit integrations participate in
the generation pipeline without coupling them to the core implementation.

Each generation run receives an isolated typed artifact registry through
`GenerationContext.artifacts`. Plugins publish and require artifacts with
`ArtifactKey<T>` values; duplicate publication and missing requirements fail
explicitly. Plugin `generate` methods may be synchronous or asynchronous.
