import type { ContractOperation, ContractSchema, ContractType } from "@hexkit/plugin-apical";
import { findJsonMedia, findSuccessResponse } from "@hexkit/shared";

/**
 * Presentation hint for a generated RSC read page.
 *
 * Derived from the operation's successful JSON response:
 * - `entries` — a single object or an `additionalProperties` map.
 * - `table` — an array of objects, rendered with these property columns.
 * - `list` — an array of non-object values.
 * - `json` — fallback for scalars, missing schemas, or unsupported shapes.
 */
export type NextUiResponseShape =
  | { kind: "entries" }
  | { kind: "table"; columns: readonly string[] }
  | { kind: "list" }
  | { kind: "json" };

/**
 * Derive the generic RSC presentation shape for a GET operation.
 *
 * References are resolved one level deep; only top-level columns matter. A
 * missing or unsupported schema falls back to the JSON dump so generation never
 * fails on contract shapes the scaffold cannot present structurally.
 */
export function deriveUiResponseShape(
  operation: ContractOperation,
  schemas: readonly ContractSchema[],
): NextUiResponseShape {
  const successResponse = findSuccessResponse(operation);
  const jsonMedia = findJsonMedia(successResponse?.media);
  return shapeForType(
    jsonMedia?.type,
    new Map(schemas.map((schema) => [schema.name, schema] as const)),
  );
}

function shapeForType(
  type: ContractType | undefined,
  schemas: ReadonlyMap<string, ContractSchema>,
): NextUiResponseShape {
  if (type === undefined) {
    return { kind: "json" };
  }

  if (type.kind === "reference") {
    return schemas.has(type.schema) ? { kind: "entries" } : { kind: "json" };
  }

  if (type.kind === "object") {
    if (type.properties.length === 0 && type.additionalProperties === undefined) {
      return { kind: "json" };
    }
    return { kind: "entries" };
  }

  if (type.kind === "array") {
    const columns = objectColumns(type.items, schemas);
    if (columns === undefined) {
      return { kind: "list" };
    }
    return columns.length === 0 ? { kind: "json" } : { kind: "table", columns };
  }

  return { kind: "json" };
}

function objectColumns(
  type: ContractType,
  schemas: ReadonlyMap<string, ContractSchema>,
): readonly string[] | undefined {
  if (type.kind === "reference") {
    const schema = schemas.get(type.schema);
    return schema === undefined ? [] : schema.properties.map((property) => property.name);
  }
  if (type.kind === "object") {
    return type.properties.map((property) => property.name);
  }
  return undefined;
}
