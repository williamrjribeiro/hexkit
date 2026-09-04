import { pluralizeCamelCase, toKebabCase, unique } from "@hexkit/codegen";
import type { ContractHttpMethod, ContractOperation } from "@hexkit/plugin-apical";

import type { ApplicationParameter, PersistenceKind, ResultCardinality } from "../artifact.ts";
import { deriveParameters, deriveReturnType } from "./parameters.ts";

export type RepositoryMethodModel = {
  operationId: string;
  name: string;
  action: string;
  parameters: readonly ApplicationParameter[];
  returnTypeExpression: string;
  resultCardinality: ResultCardinality;
  persistenceKind: PersistenceKind;
  referencedSchemas: readonly string[];
};

export type RepositoryModel = {
  aggregate: string;
  name: string;
  filePath: string;
  parameterName: string;
  methods: readonly RepositoryMethodModel[];
};

export type PersistenceKindOptions = {
  returnTypeExpression?: string;
  aggregate?: string;
};

export function persistenceKindFromAction(
  action: string,
  httpMethod: ContractHttpMethod,
  resultCardinality: ResultCardinality,
  parameterCount: number,
  options: PersistenceKindOptions = {},
): PersistenceKind {
  const kind = kindFromActionOrHttp(action, httpMethod);
  if (kind !== "select") return kind;
  if (resultCardinality === "many") return "list";
  if (parameterCount === 0) return "stub";
  if (
    options.aggregate !== undefined &&
    options.returnTypeExpression !== undefined &&
    !isAggregateEntityReturn(options.returnTypeExpression, options.aggregate)
  ) {
    return "stub";
  }
  return "select";
}

export function isAggregateEntityReturn(returnTypeExpression: string, aggregate: string): boolean {
  const compact = returnTypeExpression.replaceAll(/\s+/g, "");
  return (
    compact === aggregate ||
    compact === `${aggregate}|undefined` ||
    compact === `undefined|${aggregate}` ||
    compact === `Array<${aggregate}>`
  );
}

export function deriveRepository(
  aggregate: string,
  operations: readonly ContractOperation[],
): RepositoryModel {
  return {
    aggregate,
    name: `${aggregate}Repository`,
    filePath: `src/core/ports/${toKebabCase(aggregate)}-repository.ts`,
    parameterName: pluralizeCamelCase(aggregate),
    methods: operations.map((operation) => deriveRepositoryMethod(aggregate, operation)),
  };
}

function deriveRepositoryMethod(
  aggregate: string,
  operation: ContractOperation,
): RepositoryMethodModel {
  const parameters = deriveParameters(operation);
  const returnType = deriveReturnType(operation);
  const action = operation.extension?.action ?? operation.operationId;
  return {
    operationId: operation.operationId,
    name: operation.operationId,
    action,
    parameters: parameters.parameters,
    returnTypeExpression: returnType.expression,
    resultCardinality: returnType.resultCardinality,
    persistenceKind: persistenceKindFromAction(
      action,
      operation.method,
      returnType.resultCardinality,
      parameters.parameters.length,
      { returnTypeExpression: returnType.expression, aggregate },
    ),
    referencedSchemas: unique([...parameters.referencedSchemas, ...returnType.referencedSchemas]),
  };
}

function kindFromActionOrHttp(action: string, httpMethod: ContractHttpMethod): PersistenceKind {
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

  switch (httpMethod) {
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
        `Cannot infer persistence action for "${action}" (${httpMethod}). Add x-hexkit.operation.action.`,
      );
  }
}
