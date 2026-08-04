import type {
  ContractOperationExtension,
  ContractPersistenceExtension,
  ContractReferenceExtension,
} from "./types.ts";
import { asRecord, assertOnlyKeys, optionalRecord, requiredString } from "./values.ts";

const extensionName = "x-hexkit";

function readHexkitExtension(
  owner: Record<string, unknown>,
  allowedKeys: readonly string[],
  location: string,
): Record<string, unknown> | undefined {
  const extension = optionalRecord(owner[extensionName], `${location}.${extensionName}`);
  if (extension !== undefined) {
    assertOnlyKeys(extension, allowedKeys, `${location}.${extensionName}`);
  }

  return extension;
}

export function readPersistenceExtension(
  schema: Record<string, unknown>,
  location: string,
): ContractPersistenceExtension | undefined {
  const extension = readHexkitExtension(schema, ["persistence"], location);
  if (extension === undefined) return undefined;

  const persistence = asRecord(extension.persistence, `${location}.${extensionName}.persistence`);
  assertOnlyKeys(persistence, ["identity", "table"], `${location}.${extensionName}.persistence`);

  return {
    table: requiredString(persistence.table, `${location}.${extensionName}.persistence.table`),
    identity: requiredString(
      persistence.identity,
      `${location}.${extensionName}.persistence.identity`,
    ),
  };
}

export function readReferenceExtension(
  property: Record<string, unknown>,
  location: string,
): ContractReferenceExtension | undefined {
  const extension = readHexkitExtension(property, ["reference"], location);
  if (extension === undefined) return undefined;

  const reference = asRecord(extension.reference, `${location}.${extensionName}.reference`);
  assertOnlyKeys(reference, ["property", "schema"], `${location}.${extensionName}.reference`);

  return {
    schema: requiredString(reference.schema, `${location}.${extensionName}.reference.schema`),
    property: requiredString(reference.property, `${location}.${extensionName}.reference.property`),
  };
}

export function readOperationExtension(
  operation: Record<string, unknown>,
  location: string,
): ContractOperationExtension | undefined {
  const extension = readHexkitExtension(operation, ["operation"], location);
  if (extension === undefined) return undefined;

  const operationExtension = asRecord(
    extension.operation,
    `${location}.${extensionName}.operation`,
  );
  assertOnlyKeys(
    operationExtension,
    ["action", "aggregate"],
    `${location}.${extensionName}.operation`,
  );

  return {
    aggregate: requiredString(
      operationExtension.aggregate,
      `${location}.${extensionName}.operation.aggregate`,
    ),
    action: requiredString(
      operationExtension.action,
      `${location}.${extensionName}.operation.action`,
    ),
  };
}
