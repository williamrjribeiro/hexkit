import type {
  ContractArtifact,
  ContractMedia,
  ContractOperation,
  ContractSchema,
  ContractType,
} from "@hexkit/plugin-apical";
import { pluralizeCamelCase, toCamelCase, toKebabCase, toPascalCase } from "@hexkit/codegen";

import type {
  ApplicationArtifact,
  ApplicationAuthenticatorPort,
  ApplicationEntity,
  ApplicationParameter,
  ApplicationRepository,
  ApplicationUseCase,
} from "../artifact.ts";
import { entityEnumAliasName, renderContractType, type EnumAlias } from "./type-render.ts";

export type DomainEntityModel = {
  name: string;
  filePath: string;
  exportName: string;
  enumAliases: readonly EnumAlias[];
  properties: readonly {
    name: string;
    required: boolean;
    typeExpression: string;
  }[];
  referencedSchemas: readonly string[];
};

export type RepositoryMethodModel = {
  operationId: string;
  name: string;
  action: string;
  parameters: readonly ApplicationParameter[];
  returnTypeExpression: string;
  referencedSchemas: readonly string[];
};

export type RepositoryModel = {
  aggregate: string;
  name: string;
  filePath: string;
  parameterName: string;
  methods: readonly RepositoryMethodModel[];
};

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

export type AuthenticatorPortModel = ApplicationAuthenticatorPort;

export type ApplicationModel = {
  entities: readonly DomainEntityModel[];
  repositories: readonly RepositoryModel[];
  useCases: readonly UseCaseModel[];
  authenticatorPort?: AuthenticatorPortModel;
};

export function deriveApplicationModel(contract: ContractArtifact): ApplicationModel {
  const schemaNames = new Set(contract.schemas.map((schema) => schema.name));
  const entities = contract.schemas
    .map(deriveDomainEntity)
    .toSorted((left, right) => compareText(left.name, right.name));
  const operationsByAggregate = new Map<string, ContractOperation[]>();

  for (const operation of contract.operations) {
    const aggregate = resolveAggregate(operation, schemaNames);
    const existing = operationsByAggregate.get(aggregate) ?? [];
    existing.push(operation);
    operationsByAggregate.set(aggregate, existing);
  }

  const repositories = [...operationsByAggregate.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([aggregate, operations]) =>
      deriveRepository(
        aggregate,
        operations.toSorted((left, right) => compareText(left.operationId, right.operationId)),
      ),
    );

  const repositoryByAggregate = new Map(
    repositories.map((repository) => [repository.aggregate, repository]),
  );

  const useCases = contract.operations
    .toSorted((left, right) => compareText(left.operationId, right.operationId))
    .map((operation) => {
      const aggregate = resolveAggregate(operation, schemaNames);
      const repository = repositoryByAggregate.get(aggregate);
      if (repository === undefined) {
        throw new Error(`Missing repository model for aggregate "${aggregate}".`);
      }
      return deriveUseCase(operation, repository);
    });
  const authenticatorPort = useCases.some((useCase) => useCase.requiresAuth)
    ? ({
        name: "Authenticator",
        filePath: "src/core/ports/authenticator.ts",
      } satisfies AuthenticatorPortModel)
    : undefined;

  return {
    entities,
    repositories,
    useCases,
    ...(authenticatorPort === undefined ? {} : { authenticatorPort }),
  };
}

export function toApplicationArtifact(model: ApplicationModel): ApplicationArtifact {
  const entities: ApplicationEntity[] = model.entities.map((entity) => ({
    name: entity.name,
    exportName: entity.exportName,
    filePath: entity.filePath,
  }));

  const repositories: ApplicationRepository[] = model.repositories.map((repository) => ({
    aggregate: repository.aggregate,
    name: repository.name,
    filePath: repository.filePath,
    parameterName: repository.parameterName,
    methods: repository.methods.map((method) => ({
      operationId: method.operationId,
      name: method.name,
      action: method.action,
      parameters: method.parameters,
      returnTypeExpression: method.returnTypeExpression,
    })),
  }));

  const useCases: ApplicationUseCase[] = model.useCases.map((useCase) => ({
    operationId: useCase.operationId,
    typeName: useCase.typeName,
    factoryName: useCase.factoryName,
    filePath: useCase.filePath,
    requiresAuth: useCase.requiresAuth,
    repositoryName: useCase.repositoryName,
    repositoryParameterName: useCase.repositoryParameterName,
    methodName: useCase.methodName,
    parameters: useCase.parameters,
    returnTypeExpression: useCase.returnTypeExpression,
  }));

  return {
    artifactVersion: 1,
    entities,
    repositories,
    useCases,
    ...(model.authenticatorPort === undefined
      ? {}
      : { authenticatorPort: model.authenticatorPort }),
  };
}

function deriveDomainEntity(schema: ContractSchema): DomainEntityModel {
  const enumAliases: EnumAlias[] = [];
  const referencedSchemas: string[] = [];
  const properties = schema.properties.map((property) => {
    const rendered = renderContractType(property.type, {
      enumTypeName: entityEnumAliasName(schema.name, property.name),
    });
    enumAliases.push(...rendered.enumAliases);
    referencedSchemas.push(...rendered.referencedSchemas);
    return {
      name: property.name,
      required: property.required,
      typeExpression: rendered.expression,
    };
  });

  return {
    name: schema.name,
    exportName: schema.name,
    filePath: `src/core/domain/${toKebabCase(schema.name)}.ts`,
    enumAliases,
    properties,
    referencedSchemas: unique(referencedSchemas.filter((name) => name !== schema.name)),
  };
}

function deriveRepository(
  aggregate: string,
  operations: readonly ContractOperation[],
): RepositoryModel {
  return {
    aggregate,
    name: `${aggregate}Repository`,
    filePath: `src/core/ports/${toKebabCase(aggregate)}-repository.ts`,
    parameterName: pluralizeCamelCase(aggregate),
    methods: operations.map((operation) => {
      const parameters = deriveParameters(operation);
      const returnType = deriveReturnType(operation);
      return {
        operationId: operation.operationId,
        name: operation.operationId,
        action: operation.extension?.action ?? operation.operationId,
        parameters: parameters.parameters,
        returnTypeExpression: returnType.expression,
        referencedSchemas: unique([
          ...parameters.referencedSchemas,
          ...returnType.referencedSchemas,
        ]),
      };
    }),
  };
}

function deriveUseCase(operation: ContractOperation, repository: RepositoryModel): UseCaseModel {
  const method = repository.methods.find((entry) => entry.operationId === operation.operationId);
  if (method === undefined) {
    throw new Error(
      `Repository "${repository.name}" is missing method for operation "${operation.operationId}".`,
    );
  }

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

function requiresAuth(operation: ContractOperation): boolean {
  return operation.security.apicalServerHeaderNames.length > 0;
}

function resolveAggregate(operation: ContractOperation, schemaNames: ReadonlySet<string>): string {
  if (operation.extension?.aggregate !== undefined) {
    return operation.extension.aggregate;
  }

  const fromRequest = schemaReferenceFromMedia(operation.requestBody?.media);
  if (fromRequest !== undefined && schemaNames.has(fromRequest)) {
    return fromRequest;
  }

  for (const response of operation.responses) {
    if (!isSuccessStatus(response.status)) continue;
    const fromResponse = schemaReferenceFromMedia(response.media);
    if (fromResponse !== undefined && schemaNames.has(fromResponse)) {
      return fromResponse;
    }
  }

  const fromPath = inferAggregateFromPath(operation.path, schemaNames);
  if (fromPath !== undefined) {
    return fromPath;
  }

  throw new Error(
    `Cannot infer aggregate for operation "${operation.operationId}". Add x-hexkit.operation.aggregate.`,
  );
}

function inferAggregateFromPath(
  path: string,
  schemaNames: ReadonlySet<string>,
): string | undefined {
  const schemasByLower = new Map(
    [...schemaNames].map((name) => [name.toLowerCase(), name] as const),
  );

  const segments = path
    .split("/")
    .filter((segment) => segment.length > 0 && !segment.startsWith("{"));

  for (const segment of [...segments].toReversed()) {
    for (const candidate of [segment, segment.replace(/s$/i, "")]) {
      const match = schemasByLower.get(candidate.toLowerCase());
      if (match !== undefined) return match;
    }
  }

  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    const parameterName = match[1] ?? "";
    if (!/id$/i.test(parameterName)) continue;
    const baseName = parameterName.replace(/id$/i, "");
    const schema = schemasByLower.get(baseName.toLowerCase());
    if (schema !== undefined) return schema;
  }

  return undefined;
}

function deriveParameters(operation: ContractOperation): {
  parameters: ApplicationParameter[];
  referencedSchemas: string[];
} {
  const requestMedia = operation.requestBody?.media.find(
    (media) => media.mediaType === "application/json" && media.type !== undefined,
  );

  if (requestMedia?.type !== undefined) {
    if (requestMedia.type.kind === "reference") {
      return {
        parameters: [
          {
            name: toCamelCase(requestMedia.type.schema),
            typeExpression: requestMedia.type.schema,
          },
        ],
        referencedSchemas: [requestMedia.type.schema],
      };
    }

    const rendered = renderContractType(requestMedia.type);
    return {
      parameters: [
        {
          name: "body",
          typeExpression: rendered.expression,
        },
      ],
      referencedSchemas: [...rendered.referencedSchemas],
    };
  }

  const pathParameters = operation.parameters.filter((parameter) => parameter.location === "path");
  if (pathParameters.length === 0) {
    throw new Error(
      `Operation "${operation.operationId}" has no request body or path parameters to bind as use-case input.`,
    );
  }

  const parameters: ApplicationParameter[] = [];
  const referencedSchemas: string[] = [];
  for (const parameter of pathParameters) {
    const rendered = renderContractType(parameter.type);
    parameters.push({
      name: parameter.name,
      typeExpression: rendered.expression,
    });
    referencedSchemas.push(...rendered.referencedSchemas);
  }

  return { parameters, referencedSchemas };
}

function deriveReturnType(operation: ContractOperation): {
  expression: string;
  referencedSchemas: string[];
} {
  const hasNotFound = operation.responses.some((response) => response.status === "404");
  const successResponses = operation.responses.filter((response) =>
    isSuccessStatus(response.status),
  );

  for (const response of successResponses) {
    const media = response.media.find(
      (entry) => entry.mediaType === "application/json" && entry.type !== undefined,
    );
    if (media?.type === undefined) continue;

    const rendered = renderTypeExpression(media.type);
    return {
      expression: hasNotFound ? `${rendered.expression} | undefined` : rendered.expression,
      referencedSchemas: rendered.referencedSchemas,
    };
  }

  return { expression: "void", referencedSchemas: [] };
}

function renderTypeExpression(type: ContractType): {
  expression: string;
  referencedSchemas: string[];
} {
  const rendered = renderContractType(type);
  return {
    expression: rendered.expression,
    referencedSchemas: [...rendered.referencedSchemas],
  };
}

function schemaReferenceFromMedia(media: readonly ContractMedia[] | undefined): string | undefined {
  if (media === undefined) return undefined;
  for (const entry of media) {
    if (entry.type?.kind === "reference") {
      return entry.type.schema;
    }
  }
  return undefined;
}

function isSuccessStatus(status: string): boolean {
  return /^2\d\d$/.test(status);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
