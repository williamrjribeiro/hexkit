import type { ContractArtifact } from "@hexkit/plugin-apical";
import { compareText } from "@hexkit/codegen";

import type {
  ApplicationArtifact,
  ApplicationAuthenticatorPort,
  ApplicationEntity,
  ApplicationRepository,
  ApplicationUseCase,
} from "../artifact.ts";
import { groupOperationsByAggregate } from "./aggregate.ts";
import { deriveDomainEntity, type DomainEntityModel } from "./entity.ts";
import { deriveRepository, type RepositoryModel } from "./repository.ts";
import { deriveUseCase, type UseCaseModel } from "./use-case.ts";

export type { DomainEntityModel } from "./entity.ts";
export type { RepositoryMethodModel, RepositoryModel } from "./repository.ts";
export type { UseCaseModel } from "./use-case.ts";

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
  const modeled = groupOperationsByAggregate(contract.operations, schemaNames).map(
    ([aggregate, operations]) => {
      const sortedOperations = operations.toSorted((left, right) =>
        compareText(left.operationId, right.operationId),
      );
      const repository = deriveRepository(aggregate, sortedOperations);
      return {
        repository,
        useCases: sortedOperations.map((operation, index) =>
          deriveUseCase(operation, repository, methodAt(repository, index, operation.operationId)),
        ),
      };
    },
  );

  const repositories = modeled.map((entry) => entry.repository);
  const useCases = modeled
    .flatMap((entry) => entry.useCases)
    .toSorted((left, right) => compareText(left.operationId, right.operationId));
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
      resultCardinality: method.resultCardinality,
      persistenceKind: method.persistenceKind,
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

function methodAt(repository: RepositoryModel, index: number, operationId: string) {
  const method = repository.methods[index];
  if (method === undefined) {
    throw new Error(
      `Repository "${repository.name}" is missing method for operation "${operationId}".`,
    );
  }
  return method;
}
