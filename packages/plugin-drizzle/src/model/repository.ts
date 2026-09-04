import { toKebabCase, toPascalCase } from "@hexkit/codegen";
import type { ContractOperation } from "@hexkit/plugin-apical";
import type { ApplicationRepository } from "@hexkit/plugin-architecture-hexagonal";

import type { PersistenceMethodKind } from "./method-kind.ts";
import type { PersistenceTableModel } from "./table.ts";

export type PersistenceRepositoryMethodModel = {
  operationId: string;
  name: string;
  kind: PersistenceMethodKind;
  parameters: readonly {
    name: string;
    typeExpression: string;
    location?: "path" | "query";
  }[];
  returnTypeExpression: string;
  entityParameterName: string;
  identityParameterName: string;
  lookupColumnName: string;
  successHeaders?: readonly { name: string; typeExpression: string }[];
};

export type PersistenceRepositoryModel = {
  aggregate: string;
  portName: string;
  factoryName: string;
  filePath: string;
  runtimeKey: string;
  table: PersistenceTableModel;
  methods: readonly PersistenceRepositoryMethodModel[];
};

export function deriveRepository(
  repository: ApplicationRepository,
  tablesBySchema: ReadonlyMap<string, PersistenceTableModel>,
  operationsById: ReadonlyMap<string, ContractOperation>,
): PersistenceRepositoryModel {
  const table = tablesBySchema.get(repository.aggregate);
  if (table === undefined) {
    throw new Error(
      `Application repository aggregate "${repository.aggregate}" has no schema with x-hexkit.persistence.`,
    );
  }

  const methods = repository.methods.map((method) => {
    const operation = operationsById.get(method.operationId);
    if (operation === undefined) {
      throw new Error(
        `Application repository method "${method.operationId}" has no matching contract operation.`,
      );
    }

    const parameters = method.parameters.map((parameter) => ({
      name: parameter.name,
      typeExpression: parameter.typeExpression,
      ...(parameter.location !== undefined ? { location: parameter.location } : {}),
    }));
    const kind = method.persistenceKind;
    const firstParameterName = parameters[0]?.name;
    const pathParameterName = parameters.find((parameter) => parameter.location === "path")?.name;
    const entityParameterName =
      parameters.find((parameter) => parameter.location === undefined)?.name ??
      firstParameterName ??
      table.schemaName.toLowerCase();
    const lookupColumnName = resolveLookupColumnName(table, parameters);

    return {
      operationId: method.operationId,
      name: method.name,
      kind,
      parameters,
      returnTypeExpression: method.returnTypeExpression,
      entityParameterName,
      identityParameterName: pathParameterName ?? firstParameterName ?? table.identityPropertyName,
      lookupColumnName,
      ...(method.successHeaders === undefined || method.successHeaders.length === 0
        ? {}
        : { successHeaders: method.successHeaders }),
    };
  });

  return {
    aggregate: repository.aggregate,
    portName: repository.name,
    factoryName: `createDrizzle${toPascalCase(repository.aggregate)}Repository`,
    filePath: `src/adapters/db/${toKebabCase(repository.aggregate)}-repository.ts`,
    runtimeKey: repository.parameterName,
    table,
    methods,
  };
}

function resolveLookupColumnName(
  table: PersistenceTableModel,
  parameters: readonly { name: string; location?: "path" | "query" }[],
): string {
  for (const parameter of parameters) {
    if (parameter.location !== "path") continue;
    if (table.columns.some((column) => column.propertyName === parameter.name)) {
      return parameter.name;
    }
  }
  return table.identityPropertyName;
}
