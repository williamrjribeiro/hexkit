import { describe, expect, it } from "vite-plus/test";

import type { ContractOperation } from "@hexkit/plugin-apical";

import { deriveUseCase } from "./use-case.ts";
import type { RepositoryMethodModel, RepositoryModel } from "./repository.ts";

const publicSecurity = {
  overridesGlobal: true,
  requirements: [],
  apicalServerHeaderNames: [],
} as const;

const operation: ContractOperation = {
  operationId: "getById",
  method: "get",
  path: "/items/{itemId}",
  modulePath: "routes/getById.ts",
  parameters: [],
  responses: [{ status: "200", description: "ok", media: [] }],
  security: publicSecurity,
};

const method: RepositoryMethodModel = {
  operationId: "getById",
  name: "loadRecord",
  action: "get",
  parameters: [{ name: "itemId", typeExpression: "string" }],
  returnTypeExpression: "Item | undefined",
  resultCardinality: "one",
  persistenceKind: "select",
  referencedSchemas: ["Item"],
};

const repository: RepositoryModel = {
  aggregate: "Item",
  name: "ItemRepository",
  filePath: "src/core/ports/item-repository.ts",
  parameterName: "items",
  methods: [method],
};

describe("Given a repository method", () => {
  it("when deriving a use case, then the passed method name is used rather than operationId lookup", () => {
    const useCase = deriveUseCase(operation, repository, method);

    expect(useCase.methodName).toBe("loadRecord");
    expect(useCase.factoryName).toBe("createGetById");
    expect(useCase.requiresAuth).toBe(false);
    expect(useCase.parameters).toEqual(method.parameters);
  });

  it("when the operation declares an apical server header, then the use case requires auth", () => {
    const useCase = deriveUseCase(
      {
        ...operation,
        security: {
          overridesGlobal: true,
          requirements: [],
          apicalServerHeaderNames: ["x-api-key"],
        },
      },
      repository,
      method,
    );

    expect(useCase.requiresAuth).toBe(true);
  });
});
