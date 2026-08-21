import type { PersistenceKind } from "@hexkit/plugin-architecture-hexagonal";

/** Alias of hexagonal `PersistenceKind` — drizzle does not classify methods. */
export type PersistenceMethodKind = PersistenceKind;
