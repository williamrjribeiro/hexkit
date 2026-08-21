import type { ContractOperation } from "@hexkit/plugin-apical";

export type PersistenceMethodKind = "delete" | "insert" | "list" | "select" | "stub" | "update";

/**
 * Classifies a repository method from the hexagonal action, falling back to
 * the contract HTTP method when the action is not a known synonym.
 *
 * Hexagonal `persistenceKind` is consumed in a later integration task; this
 * calculation still owns the vocabulary for Wave 1.
 */
export function resolveMethodKind(
  operation: ContractOperation,
  action: string,
): PersistenceMethodKind {
  const normalized = action.toLowerCase();
  if (
    normalized === "create" ||
    normalized === "add" ||
    normalized === "place" ||
    normalized === "insert"
  ) {
    return "insert";
  }
  if (normalized === "update" || normalized === "patch") {
    return "update";
  }
  if (normalized === "delete" || normalized === "remove") {
    return "delete";
  }
  if (normalized === "list" || normalized === "findall" || normalized === "index") {
    return "list";
  }
  if (
    normalized === "gethealth" ||
    normalized === "health" ||
    normalized === "healthcheck" ||
    normalized === "readiness"
  ) {
    return "stub";
  }
  if (
    normalized === "get" ||
    normalized === "read" ||
    normalized === "find" ||
    normalized.startsWith("get")
  ) {
    return "select";
  }

  switch (operation.method) {
    case "post":
      return "insert";
    case "put":
    case "patch":
      return "update";
    case "delete":
      return "delete";
    case "get":
      return "select";
    default:
      throw new Error(
        `Cannot infer persistence action for operation "${operation.operationId}" (${operation.method}). Add x-hexkit.operation.action.`,
      );
  }
}

/**
 * Refines a select into list or stub using cardinality signals already
 * computed by the caller — not by parsing a return-type string prefix.
 */
export function refineMethodKind(
  kind: PersistenceMethodKind,
  input: { parameterCount: number; returnsArray: boolean },
): PersistenceMethodKind {
  if (kind !== "select" || input.parameterCount > 0) {
    return kind;
  }

  if (input.returnsArray) {
    return "list";
  }

  // Parameterless non-list GETs (e.g. readiness) are not row lookups.
  return "stub";
}
