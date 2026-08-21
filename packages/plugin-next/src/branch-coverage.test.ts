import { describe, expect, it } from "vite-plus/test";

import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import { APPLICATION_ARTIFACT } from "@hexkit/plugin-architecture-hexagonal";
import { APICAL_CONTRACT_ARTIFACT, type ContractArtifact } from "@hexkit/plugin-apical";
import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
} from "@hexkit/plugin-api";

import { NEXT_HTTP_ARTIFACT, type NextHttpModel, type NextUiPage } from "./artifact.ts";
import { renderControllersFile } from "./generate/controllers.ts";
import { generateNextDalFromArtifacts } from "./generate/files.ts";
import { renderPageFiles } from "./generate/pages.ts";
import { renderRuntimeFile } from "./generate/runtime.ts";
import { renderServerAccessFile } from "./generate/server-access.ts";
import { deriveNextHttpModel } from "./model/derive.ts";
import {
  openApiPathToAppRouteFile,
  openApiPathToAppRouteSegments,
  openApiPathToUiPageFile,
  relativeImportPath,
} from "./model/paths.ts";
import { createNextPlugin } from "./plugin.ts";

const stringType = { kind: "string", nullable: false } as const;
const booleanType = { kind: "boolean", nullable: false } as const;
const numberType = { kind: "number", nullable: false } as const;
const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;

function baseContract(
  overrides: Partial<ContractArtifact> & {
    operations: ContractArtifact["operations"];
    securitySchemes?: ContractArtifact["securitySchemes"];
    globalSecurity?: ContractArtifact["globalSecurity"];
  },
): ContractArtifact {
  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: {
      title: "Branch Coverage API",
      version: "1.0.0",
      slug: "branch-coverage-api",
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

function okJsonGet(
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

describe("Given createNextPlugin defaults", () => {
  it("when options are omitted, then surface defaults to both", async () => {
    const contract = baseContract({
      operations: [
        okJsonGet("getItem", "/items/{itemId}", [
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
    context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
    context.artifacts.publish(APPLICATION_ARTIFACT, application);

    await createNextPlugin().generate(context);

    expect(context.artifacts.require(NEXT_HTTP_ARTIFACT).surface).toBe("both");
    expect(files.some((file) => file.path.endsWith("/route.ts"))).toBe(true);
    expect(files.some((file) => file.path.endsWith("/page.tsx"))).toBe(true);
  });

  it("when generateNextDalFromArtifacts omits options, then surface defaults to both", () => {
    const contract = baseContract({
      operations: [okJsonGet("getItem", "/items")],
    });
    const application = baseApplication([baseUseCase({ operationId: "getItem" })]);
    const { artifact } = generateNextDalFromArtifacts(contract, application);
    expect(artifact.surface).toBe("both");
  });
});

describe("Given deriveNextHttpModel error and edge branches", () => {
  it("when application is missing a use case, then derivation throws", () => {
    const contract = baseContract({
      operations: [okJsonGet("getItem", "/items")],
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
          ...okJsonGet("traceItem", "/items"),
          method: "trace",
        },
      ],
    });
    const application = baseApplication([baseUseCase({ operationId: "traceItem" })]);

    expect(() => deriveNextHttpModel(contract, application, { surface: "routes" })).toThrow(
      /HTTP method "trace" is not supported/,
    );
  });

  it("when two operations share a path and method, then routes still coalesce and sort stably", () => {
    const contract = baseContract({
      operations: [
        {
          ...okJsonGet("getItemA", "/items"),
          method: "get",
        },
        {
          ...okJsonGet("getItemB", "/items"),
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
});

describe("Given renderControllersFile error branches", () => {
  it("when application is missing a use case, then controller generation throws", () => {
    const contract = baseContract({
      operations: [okJsonGet("getItem", "/items")],
    });
    const application = baseApplication([]);
    const model: NextHttpModel = {
      surface: "routes",
      routes: [],
      uiPages: [],
      repositories: application.repositories,
    };

    expect(() => renderControllersFile(model, contract, application)).toThrow(
      /missing use case for operation "getItem"/,
    );
  });

  it("when an operation has no 2xx response, then controller generation throws", () => {
    const contract = baseContract({
      operations: [
        {
          ...okJsonGet("getItem", "/items"),
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
    const model = deriveNextHttpModel(contract, application, { surface: "routes" });

    expect(() => renderControllersFile(model, contract, application)).toThrow(
      /has no 2xx response/,
    );
  });

  it("when an operation uses TRACE, then controller generation throws", () => {
    const contract = baseContract({
      operations: [
        {
          ...okJsonGet("traceItem", "/items"),
          method: "trace",
        },
      ],
    });
    const application = baseApplication([baseUseCase({ operationId: "traceItem" })]);
    const model: NextHttpModel = {
      surface: "routes",
      routes: [],
      uiPages: [],
      repositories: application.repositories,
    };

    expect(() => renderControllersFile(model, contract, application)).toThrow(
      /HTTP method "trace" is not supported/,
    );
  });
});

describe("Given renderPageFiles parameter and error branches", () => {
  it("when application is missing a use case for a UI page, then page generation throws", () => {
    const page: NextUiPage = {
      filePath: "app/ui/items/page.tsx",
      openApiPath: "/items",
      operationId: "getItem",
      useCaseAccessorName: "getItem",
      paramNames: [],
    };
    const model: NextHttpModel = {
      surface: "both",
      routes: [],
      uiPages: [page],
      repositories: [],
    };
    const application = baseApplication([]);

    expect(() => renderPageFiles(model, application)).toThrow(
      /missing use case for operation "getItem"/,
    );
  });

  it("when a GET page has path, query boolean, and query string params, then helpers and coercions are emitted", () => {
    const contract = baseContract({
      operations: [
        okJsonGet("searchItems", "/items/{itemId}", [
          { name: "itemId", location: "path", required: true, type: numberType },
          { name: "active", location: "query", required: false, type: booleanType },
          { name: "q", location: "query", required: false, type: stringType },
        ]),
      ],
    });
    const application = baseApplication([
      baseUseCase({
        operationId: "searchItems",
        parameters: [
          { name: "itemId", typeExpression: "number" },
          { name: "active", typeExpression: "boolean" },
          { name: "q", typeExpression: "string" },
        ],
      }),
    ]);

    const { files } = generateNextDalFromArtifacts(contract, application, { surface: "both" });
    const page = files.find((file) => file.path === "app/ui/items/[itemId]/page.tsx");

    expect(page?.contents).toContain("function getSearchParam(");
    expect(page?.contents).toContain("const searchParams = await props.searchParams;");
    expect(page?.contents).toContain('Number(params["itemId"] ?? "0")');
    expect(page?.contents).toContain(
      '(getSearchParam(searchParams, "active") ?? "false") === "true"',
    );
    expect(page?.contents).toContain('getSearchParam(searchParams, "q") ?? ""');
  });
});

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
          ...okJsonGet("listItems", "/items"),
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
      {
        authenticator: true,
      },
    );
    const model = deriveNextHttpModel(contract, application, { surface: "routes" });
    const runtime = renderRuntimeFile(model, application);

    expect(runtime.contents).toContain("apiKeys: new Map([]),");
  });

  it("when use case operationIds tie during sort, then runtime and server-access still render", () => {
    const contract = baseContract({
      operations: [okJsonGet("getItem", "/items")],
    });
    const shared = baseUseCase({ operationId: "getItem" });
    const application = baseApplication([shared, { ...shared }]);
    const model = deriveNextHttpModel(contract, application, { surface: "routes" });

    expect(() => renderRuntimeFile(model, application)).not.toThrow();
    expect(() => renderServerAccessFile(model, application)).not.toThrow();
  });
});

describe("Given OpenAPI path helpers", () => {
  it("when openApiPathToAppRouteSegments is used, then dynamic segments are bracketed", () => {
    expect(openApiPathToAppRouteSegments("/pet/{petId}/photos/{photoId}")).toEqual([
      "pet",
      "[petId]",
      "photos",
      "[photoId]",
    ]);
    expect(openApiPathToAppRouteSegments("/")).toEqual([]);
    expect(openApiPathToAppRouteFile("/")).toBe("app/route.ts");
    expect(openApiPathToUiPageFile("/", { surface: "both" })).toBe("app/ui/page.tsx");
    expect(openApiPathToUiPageFile("/", { surface: "rsc" })).toBe("app/page.tsx");
  });

  it("when relativeImportPath targets a same-directory file, then a ./ prefix is added", () => {
    expect(
      relativeImportPath(
        "src/adapters/http-next/runtime.ts",
        "src/adapters/http-next/controllers.ts",
      ),
    ).toBe("./controllers.ts");
  });
});
