import { describe, expect, it } from "vite-plus/test";

import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import type { ContractArtifact } from "@hexkit/plugin-apical";

import { deriveNextHttpModel } from "./derive.ts";

const stringType = { kind: "string", nullable: false } as const;
const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;

function baseContract(
  overrides: Partial<ContractArtifact> & {
    operations: ContractArtifact["operations"];
  },
): ContractArtifact {
  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: {
      title: "Next Derive API",
      version: "1.0.0",
      slug: "next-derive-api",
    },
    schemas: [
      {
        name: "Item",
        modulePath: "schemas/Item.ts",
        properties: [
          { name: "id", required: true, type: stringType },
          { name: "name", required: true, type: stringType },
        ],
      },
    ],
    securitySchemes: overrides.securitySchemes ?? [],
    globalSecurity: overrides.globalSecurity ?? [],
    operations: overrides.operations,
  };
}

function baseUseCase(
  overrides: Partial<ApplicationArtifact["useCases"][number]> & { operationId: string },
): ApplicationArtifact["useCases"][number] {
  const operationId = overrides.operationId;
  return {
    operationId,
    typeName: overrides.typeName ?? `${operationId}UseCase`,
    factoryName: overrides.factoryName ?? `create${operationId}UseCase`,
    filePath: overrides.filePath ?? `src/core/use-cases/${operationId}.ts`,
    requiresAuth: overrides.requiresAuth ?? false,
    repositoryName: overrides.repositoryName ?? "ItemRepository",
    repositoryParameterName: overrides.repositoryParameterName ?? "itemRepository",
    methodName: overrides.methodName ?? operationId,
    parameters: overrides.parameters ?? [],
    returnTypeExpression: overrides.returnTypeExpression ?? "Item",
  };
}

function baseApplication(useCases: ApplicationArtifact["useCases"]): ApplicationArtifact {
  return {
    artifactVersion: 1,
    entities: [
      {
        name: "Item",
        exportName: "Item",
        filePath: "src/core/domain/item.ts",
      },
    ],
    repositories: [
      {
        aggregate: "Item",
        name: "ItemRepository",
        filePath: "src/core/ports/item-repository.ts",
        parameterName: "itemRepository",
        methods: [],
      },
    ],
    useCases,
  };
}

function jsonGet(
  operationId: string,
  path: string,
  parameters: ContractArtifact["operations"][number]["parameters"] = [],
): ContractArtifact["operations"][number] {
  return {
    operationId,
    method: "get",
    path,
    modulePath: `routes/${operationId}.ts`,
    parameters,
    responses: [
      {
        status: "200",
        description: "ok",
        media: [{ mediaType: "application/json", type: itemReference }],
      },
    ],
    security: {
      overridesGlobal: true,
      requirements: [],
      apicalServerHeaderNames: [],
    },
    extension: { aggregate: "Item", action: "get" },
  };
}

describe("Given deriveNextHttpModel", () => {
  it("when bindings are derived, then successStatus and useCaseArgumentExpressions are populated", () => {
    const contract = baseContract({
      operations: [
        jsonGet("getItem", "/items/{itemId}", [
          { name: "itemId", location: "path", required: true, type: stringType },
        ]),
      ],
    });
    const application = baseApplication([
      baseUseCase({
        operationId: "getItem",
        parameters: [{ name: "itemId", typeExpression: "string" }],
      }),
    ]);

    const model = deriveNextHttpModel(contract, application, { surface: "routes" });
    const binding = model.routes[0]?.methods[0];

    expect(binding).toMatchObject({
      method: "get",
      operationId: "getItem",
      useCaseTypeName: "getItemUseCase",
      useCaseFactoryName: "creategetItemUseCase",
      repositoryParameterName: "itemRepository",
      hasJsonBody: false,
      hasJsonSuccessBody: true,
      successStatus: "200",
      successMediaType: "application/json",
      useCaseArgumentExpressions: ["request.value.path.itemId"],
    });
    expect(binding?.notFoundStatus).toBeUndefined();
  });

  it("when application is missing a use case, then derivation throws", () => {
    const contract = baseContract({
      operations: [jsonGet("getItem", "/items")],
    });
    const application = baseApplication([]);

    expect(() => deriveNextHttpModel(contract, application)).toThrow(
      /missing use case for operation "getItem"/,
    );
  });

  it("when an operation uses TRACE, then derivation throws", () => {
    const contract = baseContract({
      operations: [
        {
          ...jsonGet("traceItem", "/items"),
          method: "trace",
        },
      ],
    });
    const application = baseApplication([baseUseCase({ operationId: "traceItem" })]);

    expect(() => deriveNextHttpModel(contract, application, { surface: "routes" })).toThrow(
      /HTTP method "trace" is not supported/,
    );
  });

  it("when an operation has no 2xx response, then derivation throws", () => {
    const contract = baseContract({
      operations: [
        {
          ...jsonGet("getItem", "/items"),
          responses: [
            {
              status: "404",
              description: "missing",
              media: [{ mediaType: "application/json", type: itemReference }],
            },
          ],
        },
      ],
    });
    const application = baseApplication([baseUseCase({ operationId: "getItem" })]);

    expect(() => deriveNextHttpModel(contract, application, { surface: "routes" })).toThrow(
      /has no 2xx response/,
    );
  });

  it("when a JSON body operation is authenticated and can 404, then binding arguments and statuses are complete", () => {
    const contract = baseContract({
      operations: [
        {
          ...jsonGet("updateItem", "/items/{itemId}"),
          method: "put",
          requestBody: {
            required: true,
            media: [{ mediaType: "application/json", type: itemReference }],
          },
          responses: [
            {
              status: "200",
              description: "ok",
              media: [{ mediaType: "application/json", type: itemReference }],
            },
            {
              status: "404",
              description: "missing",
              media: [],
            },
          ],
        },
      ],
    });
    const application = baseApplication([
      baseUseCase({
        operationId: "updateItem",
        requiresAuth: true,
        parameters: [{ name: "itemId", typeExpression: "string" }],
      }),
    ]);

    const model = deriveNextHttpModel(contract, application, { surface: "routes" });
    const binding = model.routes[0]?.methods[0];

    expect(binding).toMatchObject({
      hasJsonBody: true,
      hasJsonSuccessBody: true,
      successStatus: "200",
      notFoundStatus: "404",
      requiresPrincipal: true,
      useCaseArgumentExpressions: ["principal", "request.value.body"],
    });
  });

  it("when two operations share a path and method, then routes still coalesce and sort stably", () => {
    const contract = baseContract({
      operations: [
        {
          ...jsonGet("getItemA", "/items"),
          method: "get",
        },
        {
          ...jsonGet("getItemB", "/items"),
          method: "get",
        },
      ],
    });
    const application = baseApplication([
      baseUseCase({ operationId: "getItemA" }),
      baseUseCase({ operationId: "getItemB" }),
    ]);

    const model = deriveNextHttpModel(contract, application, { surface: "routes" });
    expect(model.routes).toHaveLength(1);
    expect(model.routes[0]?.methods.map((method) => method.operationId)).toEqual([
      "getItemA",
      "getItemB",
    ]);
  });

  it("when security schemes are mixed, then unsupported schemes are dropped and api keys are kept", () => {
    const contract = baseContract({
      securitySchemes: [
        { name: "internalKey", type: "apiKey", in: "header", headerName: "X-Internal-Key" },
        { name: "oauth", type: "unsupported", openApiType: "oauth2", reason: "unsupported" },
      ],
      operations: [
        {
          ...jsonGet("getItem", "/items"),
          security: {
            overridesGlobal: true,
            requirements: [
              {
                schemes: ["internalKey", "oauth", "internalKey", "missing"],
                scopes: { internalKey: [] },
              },
            ],
            apicalServerHeaderNames: ["x-internal-key"],
          },
        },
      ],
    });
    const application = baseApplication([
      baseUseCase({ operationId: "getItem", requiresAuth: true }),
    ]);

    const model = deriveNextHttpModel(contract, application, { surface: "routes" });
    expect(model.routes[0]?.methods[0]?.authSchemes).toEqual([
      { name: "internalKey", type: "apiKey", headerName: "X-Internal-Key" },
    ]);
  });

  it("when a GET page is derived, then use-case parameters are copied onto the UI page", () => {
    const contract = baseContract({
      operations: [
        jsonGet("getItem", "/items/{itemId}", [
          { name: "itemId", location: "path", required: true, type: stringType },
        ]),
      ],
    });
    const application = baseApplication([
      baseUseCase({
        operationId: "getItem",
        parameters: [{ name: "itemId", typeExpression: "string" }],
      }),
    ]);

    const model = deriveNextHttpModel(contract, application, { surface: "both" });
    expect(model.uiPages).toEqual([
      expect.objectContaining({
        operationId: "getItem",
        paramNames: ["itemId"],
        parameters: [{ name: "itemId", typeExpression: "string" }],
      }),
    ]);
  });
});
