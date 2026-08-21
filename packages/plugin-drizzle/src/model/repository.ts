import { toKebabCase, toPascalCase } from "@hexkit/codegen";
import type { ContractOperation } from "@hexkit/plugin-apical";
import type { ApplicationRepository } from "@hexkit/plugin-architecture-hexagonal";

import type { PersistenceMethodKind } from "./method-kind.ts";
import type { PersistenceTableModel } from "./table.ts";

export type PersistenceRepositoryMethodModel = {
  operationId: string;
  name: string;
  kind: PersistenceMethodKind;
  parameters: readonly { name: string; typeExpression: string }[];
  returnTypeExpression: string;
  entityParameterName: string;
  identityParameterName: string;
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
    }));
    const kind = method.persistenceKind;
    const firstParameterName = parameters[0]?.name;

    return {
      operationId: method.operationId,
      name: method.name,
      kind,
      parameters,
      returnTypeExpression: method.returnTypeExpression,
      entityParameterName: firstParameterName ?? table.schemaName.toLowerCase(),
      identityParameterName: firstParameterName ?? table.identityPropertyName,
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
