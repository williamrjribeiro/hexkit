import { describe, expect, it } from "vite-plus/test";

import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import { APPLICATION_ARTIFACT } from "@hexkit/plugin-architecture-hexagonal";
import { APICAL_CONTRACT_ARTIFACT, type ContractArtifact } from "@hexkit/plugin-apical";
import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
} from "@hexkit/plugin-api";

import { NEXT_HTTP_ARTIFACT } from "../artifact.ts";
import { generateNextDalFromArtifacts } from "./files.ts";
import { createNextPlugin } from "../plugin.ts";

const stringType = { kind: "string", nullable: false } as const;
const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;

function itemContract(): ContractArtifact {
  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: {
      title: "Next Files API",
      version: "1.0.0",
      slug: "next-files-api",
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
    securitySchemes: [],
    globalSecurity: [],
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
  };
}

function itemApplication(): ApplicationArtifact {
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
    useCases: [
      {
        operationId: "getItem",
        typeName: "getItemUseCase",
        factoryName: "creategetItemUseCase",
        filePath: "src/core/use-cases/getItem.ts",
        requiresAuth: false,
        repositoryName: "ItemRepository",
        repositoryParameterName: "itemRepository",
        methodName: "getItem",
        parameters: [],
        returnTypeExpression: "Item",
      },
    ],
  };
}

describe("Given generateNextDalFromArtifacts defaults", () => {
  it("when options are omitted, then surface defaults to both", () => {
    const { artifact } = generateNextDalFromArtifacts(itemContract(), itemApplication());
    expect(artifact.surface).toBe("both");
  });
});

describe("Given createNextPlugin defaults", () => {
  it("when options are omitted, then surface defaults to both", async () => {
    const files: GeneratedFile[] = [];
    const context: GenerationContext = {
      inputPath: "openapi.yaml",
      outputDirectory: "/tmp/generated-next-defaults",
      artifacts: createArtifactRegistry(),
      writeFile(file) {
        files.push(file);
      },
      log() {},
    };
    context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, itemContract());
    context.artifacts.publish(APPLICATION_ARTIFACT, itemApplication());

    await createNextPlugin().generate(context);

    expect(context.artifacts.require(NEXT_HTTP_ARTIFACT).surface).toBe("both");
    expect(files.some((file) => file.path.endsWith("/route.ts"))).toBe(true);
    expect(files.some((file) => file.path.endsWith("/page.tsx"))).toBe(true);
  });
});
