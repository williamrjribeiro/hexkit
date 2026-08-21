import { describe, expect, it } from "vite-plus/test";

import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import type { ContractArtifact } from "@hexkit/plugin-apical";

import { deriveNextHttpModel } from "../model/derive.ts";
import { renderRuntimeFile } from "./runtime.ts";
import { renderServerAccessFile } from "./server-access.ts";

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
      title: "Next Runtime API",
      version: "1.0.0",
      slug: "next-runtime-api",
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

function baseApplication(
  useCases: ApplicationArtifact["useCases"],
  options?: { authenticator?: boolean },
): ApplicationArtifact {
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
    ...(options?.authenticator
      ? {
          authenticatorPort: {
            name: "Authenticator" as const,
            filePath: "src/core/ports/authenticator.ts" as const,
          },
        }
      : {}),
  };
}

describe("Given runtime apiKey defaults and stable sort ties", () => {
  it("when auth is bearer-only, then apiKeys default to an empty map literal", () => {
    const contract = baseContract({
      securitySchemes: [
        {
          name: "adminBearer",
          type: "http",
          scheme: "bearer",
          headerName: "Authorization",
          bearerFormat: "JWT",
        },
      ],
      globalSecurity: [{ schemes: ["adminBearer"], scopes: { adminBearer: [] } }],
      operations: [
        {
          operationId: "listItems",
          method: "get",
          path: "/items",
          modulePath: "routes/listItems.ts",
          parameters: [],
          responses: [
            {
              status: "200",
              description: "ok",
              media: [{ mediaType: "application/json", type: itemReference }],
            },
          ],
          security: {
            overridesGlobal: false,
            requirements: [{ schemes: ["adminBearer"], scopes: { adminBearer: [] } }],
            apicalServerHeaderNames: ["authorization"],
          },
          extension: { aggregate: "Item", action: "list" },
        },
      ],
    });
    const application = baseApplication(
      [baseUseCase({ operationId: "listItems", requiresAuth: true })],
      { authenticator: true },
    );
    const model = deriveNextHttpModel(contract, application, { surface: "routes" });
    const runtime = renderRuntimeFile(model, application);

    expect(runtime.contents).toContain("apiKeys: new Map([]),");
  });

  it("when use case operationIds tie during sort, then runtime and server-access still render", () => {
    const contract = baseContract({
      operations: [
        {
          operationId: "getItem",
          method: "get",
          path: "/items",
          modulePath: "routes/getItem.ts",
          parameters: [],
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
        },
      ],
    });
    const shared = baseUseCase({ operationId: "getItem" });
    const application = baseApplication([shared, { ...shared }]);
    const model = deriveNextHttpModel(contract, application, { surface: "routes" });

    expect(() => renderRuntimeFile(model, application)).not.toThrow();
    expect(() => renderServerAccessFile(model, application)).not.toThrow();
  });
});
