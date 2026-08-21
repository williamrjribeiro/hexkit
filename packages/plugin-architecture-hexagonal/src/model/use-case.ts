import { toKebabCase, toPascalCase } from "@hexkit/codegen";
import type { ContractOperation } from "@hexkit/plugin-apical";

import type { ApplicationParameter } from "../artifact.ts";
import type { RepositoryMethodModel, RepositoryModel } from "./repository.ts";

export type UseCaseModel = {
  operationId: string;
  typeName: string;
  factoryName: string;
  filePath: string;
  aggregate: string;
  repositoryName: string;
  repositoryParameterName: string;
  methodName: string;
  requiresAuth: boolean;
  parameters: readonly ApplicationParameter[];
  returnTypeExpression: string;
  referencedSchemas: readonly string[];
};

export function deriveUseCase(
  operation: ContractOperation,
  repository: RepositoryModel,
  method: RepositoryMethodModel,
): UseCaseModel {
  const typeName = toPascalCase(operation.operationId);
  return {
    operationId: operation.operationId,
    typeName,
    factoryName: `create${typeName}`,
    filePath: `src/core/application/${toKebabCase(operation.operationId)}.ts`,
    aggregate: repository.aggregate,
    repositoryName: repository.name,
    repositoryParameterName: repository.parameterName,
    methodName: method.name,
    requiresAuth: requiresAuth(operation),
    parameters: method.parameters,
    returnTypeExpression: method.returnTypeExpression,
    referencedSchemas: method.referencedSchemas,
  };
}

export function requiresAuth(operation: ContractOperation): boolean {
  return operation.security.apicalServerHeaderNames.length > 0;
}
