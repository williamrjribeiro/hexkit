import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vite-plus/test";

import { generateApplicationFromContract } from "@hexkit/plugin-architecture-hexagonal";
import { APPLICATION_ARTIFACT } from "@hexkit/plugin-architecture-hexagonal";
import {
  APICAL_CONTRACT_ARTIFACT,
  loadValidatedOpenApi,
  normalizeContractArtifact,
  type ContractArtifact,
} from "@hexkit/plugin-apical";
import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
  type HexkitPlugin,
} from "@hexkit/plugin-api";

import { NEXT_HTTP_ARTIFACT, type NextHttpArtifact, type NextSurface } from "./artifact.ts";
import { generateNextDalFromArtifacts } from "./generate/files.ts";
import { deriveNextHttpModel } from "./model/derive.ts";

const petstoreOpenApi = new URL("../../../apps/petstore-sample/openapi.poc.yaml", import.meta.url)
  .pathname;
const libraryOpenApi = new URL("../../../apps/fixtures/library-api/openapi.yaml", import.meta.url)
  .pathname;

const petstoreModules = {
  schemas: new Map([
    ["Order", "schemas/Order.ts"],
    ["Pet", "schemas/Pet.ts"],
  ]),
  operations: new Map([
    ["addPet", "routes/addPet.ts"],
    ["updatePet", "routes/updatePet.ts"],
    ["getPetById", "routes/getPetById.ts"],
    ["deletePet", "routes/deletePet.ts"],
    ["placeOrder", "routes/placeOrder.ts"],
    ["getOrderById", "routes/getOrderById.ts"],
    ["deleteOrder", "routes/deleteOrder.ts"],
  ]),
};

const libraryModules = {
  schemas: new Map([
    ["Author", "schemas/Author.ts"],
    ["Book", "schemas/Book.ts"],
  ]),
  operations: new Map([
    ["createBook", "routes/createBook.ts"],
    ["getBook", "routes/getBook.ts"],
  ]),
};

const productionSourceRoots = ["artifact.ts", "generate", "model", "plugin.ts", "index.ts"];

let petstoreContract: ContractArtifact;
let libraryContract: ContractArtifact;

beforeAll(async () => {
  [petstoreContract, libraryContract] = await Promise.all([
    loadContract(petstoreOpenApi, petstoreModules),
    loadContract(libraryOpenApi, libraryModules),
  ]);
});

async function loadContract(
  openApiPath: string,
  modules: {
    schemas: ReadonlyMap<string, string>;
    operations: ReadonlyMap<string, string>;
  },
): Promise<ContractArtifact> {
  return normalizeContractArtifact(await loadValidatedOpenApi(openApiPath), modules);
}

function readProductionSources(): string {
  const root = join(import.meta.dirname);
  const chunks: string[] = [];

  const visit = (path: string): void => {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const absolute = join(path, item.name);
      if (item.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!item.name.endsWith(".ts") || item.name.endsWith(".test.ts")) continue;
      chunks.push(readFileSync(absolute, "utf8"));
    }
  };

  for (const entry of productionSourceRoots) {
    const path = join(root, entry);
    if (entry.endsWith(".ts")) {
      chunks.push(readFileSync(path, "utf8"));
      continue;
    }
    visit(path);
  }

  return chunks.join("\n");
}

async function collectGeneratedFiles(
  contract: ContractArtifact,
  surface: NextSurface,
): Promise<{ files: GeneratedFile[]; artifact: NextHttpArtifact }> {
  const application = generateApplicationFromContract(contract).artifact;
  const files: GeneratedFile[] = [];
  const context: GenerationContext = {
    inputPath: "openapi.yaml",
    outputDirectory: "/tmp/generated-next-app",
    artifacts: createArtifactRegistry(),
    writeFile(file: GeneratedFile) {
      files.push(file);
    },
    log() {},
  };
  const pluginModule = (await import("./plugin.ts")) as {
    createNextPlugin: (options?: { surface?: NextSurface }) => HexkitPlugin;
  };
  const createNextPlugin = pluginModule.createNextPlugin;

  context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
  context.artifacts.publish(APPLICATION_ARTIFACT, application);
  await createNextPlugin({ surface }).generate(context);

  return {
    files,
    artifact: context.artifacts.require(NEXT_HTTP_ARTIFACT),
  };
}

function fileMap(files: readonly GeneratedFile[]): Map<string, GeneratedFile> {
  return new Map(files.map((file) => [file.path, file] as const));
}

function expectNoPageRouteCollisions(paths: readonly string[]): void {
  const pathSet = new Set(paths);
  for (const path of paths) {
    if (!path.endsWith("/route.ts")) continue;
    expect(pathSet.has(path.replace(/route\.ts$/, "page.tsx"))).toBe(false);
  }
}

function countPath(paths: readonly string[], path: string): number {
  return paths.filter((candidate) => candidate === path).length;
}

function createRootContract(): ContractArtifact {
  const stringType = { kind: "string", nullable: false } as const;
  const rootReference = { kind: "reference", nullable: false, schema: "RootResource" } as const;

  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: {
      title: "Root API Fixture",
      version: "1.0.0",
      slug: "root-api-fixture",
    },
    schemas: [
      {
        name: "RootResource",
        modulePath: "schemas/RootResource.ts",
        properties: [{ name: "id", required: true, type: stringType }],
      },
    ],
    securitySchemes: [],
    globalSecurity: [],
    operations: [
      {
        operationId: "getRootResource",
        method: "get",
        path: "/",
        modulePath: "routes/getRootResource.ts",
        parameters: [],
        responses: [
          {
            status: "200",
            description: "ok",
            media: [{ mediaType: "application/json", type: rootReference }],
          },
        ],
        security: {
          overridesGlobal: true,
          requirements: [],
          apicalServerHeaderNames: [],
        },
        extension: { aggregate: "RootResource", action: "get" },
      },
    ],
  };
}

function createSecuredContract(): ContractArtifact {
  const stringType = { kind: "string", nullable: false } as const;
  const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;

  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: {
      title: "Secured API Fixture",
      version: "1.0.0",
      slug: "secured-api-fixture",
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
    securitySchemes: [
      {
        name: "adminBearer",
        type: "http",
        scheme: "bearer",
        headerName: "Authorization",
        bearerFormat: "JWT",
      },
      { name: "internalKey", type: "apiKey", in: "header", headerName: "X-Internal-Key" },
    ],
    globalSecurity: [{ schemes: ["adminBearer"], scopes: { adminBearer: [] } }],
    operations: [
      {
        operationId: "createItem",
        method: "post",
        path: "/items",
        modulePath: "routes/createItem.ts",
        parameters: [],
        responses: [
          {
            status: "201",
            description: "created",
            media: [{ mediaType: "application/json", type: itemReference }],
          },
        ],
        security: {
          overridesGlobal: true,
          requirements: [{ schemes: ["internalKey"], scopes: { internalKey: [] } }],
          apicalServerHeaderNames: ["x-internal-key"],
        },
        requestBody: {
          required: true,
          media: [{ mediaType: "application/json", type: itemReference }],
        },
        extension: { aggregate: "Item", action: "create" },
      },
      {
        operationId: "getPublicCatalog",
        method: "get",
        path: "/catalog",
        modulePath: "routes/getPublicCatalog.ts",
        parameters: [],
        responses: [
          {
            status: "200",
            description: "ok",
            media: [
              {
                mediaType: "application/json",
                type: { kind: "array", nullable: false, items: itemReference },
              },
            ],
          },
        ],
        security: {
          overridesGlobal: true,
          requirements: [],
          apicalServerHeaderNames: [],
        },
        extension: { aggregate: "Item", action: "getPublic" },
      },
      {
        operationId: "listItems",
        method: "get",
        path: "/items/{itemId}",
        modulePath: "routes/listItems.ts",
        parameters: [
          {
            name: "itemId",
            location: "path",
            required: true,
            type: stringType,
          },
        ],
        responses: [
          {
            status: "200",
            description: "ok",
            media: [
              {
                mediaType: "application/json",
                type: { kind: "array", nullable: false, items: itemReference },
              },
            ],
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
  };
}

describe("Given ContractArtifact + ApplicationArtifact for Petstore", () => {
  it("when routes are derived, then the same OpenAPI path coalesces methods into one NextRouteFile", () => {
    const application = generateApplicationFromContract(petstoreContract).artifact;
    const model = deriveNextHttpModel(petstoreContract, application, { surface: "routes" });

    const petRoute = model.routes.find((route) => route.openApiPath === "/pet");
    const petByIdRoute = model.routes.find((route) => route.openApiPath === "/pet/{petId}");
    const orderByIdRoute = model.routes.find(
      (route) => route.openApiPath === "/store/order/{orderId}",
    );

    expect(petRoute).toEqual({
      filePath: "app/pet/route.ts",
      openApiPath: "/pet",
      methods: expect.arrayContaining([
        expect.objectContaining({ method: "post", operationId: "addPet" }),
        expect.objectContaining({ method: "put", operationId: "updatePet" }),
      ]),
    });
    expect(petRoute?.methods).toHaveLength(2);

    expect(petByIdRoute?.methods.map((method) => method.operationId).toSorted()).toEqual([
      "deletePet",
      "getPetById",
    ]);
    expect(orderByIdRoute?.methods.map((method) => method.operationId).toSorted()).toEqual([
      "deleteOrder",
      "getOrderById",
    ]);
  });

  it("when surface is both, then routes, app/ui pages, and server-access are derived", () => {
    const application = generateApplicationFromContract(petstoreContract).artifact;
    const model = deriveNextHttpModel(petstoreContract, application, { surface: "both" });
    const { files } = generateNextDalFromArtifacts(petstoreContract, application, {
      surface: "both",
    });

    expect(model.routes.length).toBeGreaterThan(0);
    expect(model.uiPages.map((page) => page.filePath)).toEqual(
      expect.arrayContaining([
        "app/ui/pet/[petId]/page.tsx",
        "app/ui/store/order/[orderId]/page.tsx",
      ]),
    );
    expect(model.uiPages.every((page) => page.operationId.startsWith("get"))).toBe(true);
    expect(files.some((file) => file.path === "src/adapters/http-next/server-access.ts")).toBe(
      true,
    );
  });

  it("when surface is both, then generation emits contract routes, ui pages, layout, index, and runtime", async () => {
    const { files, artifact } = await collectGeneratedFiles(petstoreContract, "both");
    const filesByPath = fileMap(files);
    const paths = files.map((file) => file.path);
    const route = filesByPath.get("app/pet/[petId]/route.ts");
    const page = filesByPath.get("app/ui/pet/[petId]/page.tsx");
    const serverAccess = filesByPath.get("src/adapters/http-next/server-access.ts");

    expect(paths).toEqual(
      expect.arrayContaining([
        "app/layout.tsx",
        "app/page.tsx",
        "app/ui/page.tsx",
        "app/pet/route.ts",
        "app/pet/[petId]/route.ts",
        "app/store/order/[orderId]/route.ts",
        "app/ui/pet/[petId]/page.tsx",
        "app/ui/store/order/[orderId]/page.tsx",
        "src/adapters/http-next/helpers.ts",
        "src/adapters/http-next/controllers.ts",
        "src/adapters/http-next/runtime.ts",
        "src/adapters/http-next/server-access.ts",
      ]),
    );
    expect(files.every((file) => file.ownership === "generated")).toBe(true);
    expectNoPageRouteCollisions(paths);

    expect(route?.contents).toContain('import type { NextRequest } from "next/server";');
    expect(route?.contents).toContain('import { getRuntime } from "@/adapters/http-next/runtime";');
    expect(route?.contents).toContain("export async function GET(");
    expect(route?.contents).toContain("ctx: { params: Promise<Record<string, string>> },");
    expect(route?.contents).toContain("const params = await ctx.params;");
    expect(route?.contents).toContain(
      "const apicalRequest = await toApicalRequest(request, params, { jsonBody: false });",
    );
    expect(route?.contents).toContain("const result = await runtime.controllers.getPetById(");
    expect(route?.contents).toContain("export async function DELETE(");
    expect(route?.contents).not.toContain("force-static");

    expect(page?.contents).toContain(
      'import { getServerAccess } from "@/adapters/http-next/server-access";',
    );
    expect(page?.contents).toContain("const params = await props.params;");
    expect(page?.contents).toContain("const searchParams = await props.searchParams;");
    expect(page?.contents).toContain("const access = getServerAccess();");
    expect(page?.contents).toContain("const result = await access.getPetById(");
    expect(page?.contents).toContain('<h1>{"getPetById"}</h1>');
    expect(page?.contents).not.toContain("fetch(");
    expect(page?.contents).not.toContain("force-static");

    expect(filesByPath.get("app/page.tsx")?.contents).toContain('href="/ui/pet/[petId]"');
    expect(filesByPath.get("app/ui/page.tsx")?.contents).toContain(
      'href="/ui/store/order/[orderId]"',
    );
    for (const uiPage of artifact.uiPages) {
      const generatedPage = filesByPath.get(uiPage.filePath);
      expect(serverAccess?.contents).toContain(`  ${uiPage.useCaseAccessorName}:`);
      expect(generatedPage?.contents).toContain(`access.${uiPage.useCaseAccessorName}(`);
    }

    const generatedSource = files.map((file) => file.contents).join("\n");
    expect(generatedSource).not.toMatch(/\bBook\b|createBook|getBook|\/books/);
  });

  it("when surface is routes, then routes and server-access are derived with empty uiPages", () => {
    const application = generateApplicationFromContract(petstoreContract).artifact;
    const model = deriveNextHttpModel(petstoreContract, application, { surface: "routes" });
    const { files } = generateNextDalFromArtifacts(petstoreContract, application, {
      surface: "routes",
    });

    expect(model.routes.length).toBeGreaterThan(0);
    expect(model.uiPages).toEqual([]);
    expect(files.some((file) => file.path === "src/adapters/http-next/server-access.ts")).toBe(
      true,
    );
    expect(files.some((file) => file.path === "src/adapters/http-next/helpers.ts")).toBe(true);
    expect(files.some((file) => file.path === "src/adapters/http-next/controllers.ts")).toBe(true);
    expect(files.every((file) => !file.path.startsWith("app/ui/"))).toBe(true);
  });

  it("when surface is routes, then generation emits handlers and server-access without resource pages", async () => {
    const { files, artifact } = await collectGeneratedFiles(petstoreContract, "routes");
    const filesByPath = fileMap(files);
    const paths = files.map((file) => file.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        "app/layout.tsx",
        "app/page.tsx",
        "app/pet/[petId]/route.ts",
        "src/adapters/http-next/server-access.ts",
        "src/adapters/http-next/helpers.ts",
        "src/adapters/http-next/controllers.ts",
        "src/adapters/http-next/runtime.ts",
      ]),
    );
    expect(paths.some((path) => path.startsWith("app/ui/"))).toBe(false);
    expect(paths.some((path) => path.endsWith("/page.tsx") && path !== "app/page.tsx")).toBe(false);
    expect(filesByPath.get("app/page.tsx")?.contents).toContain("API only");
    expect(artifact.uiPages).toEqual([]);
    expect(artifact.routes.length).toBeGreaterThan(0);
    expectNoPageRouteCollisions(paths);
  });

  it("when surface is rsc, then pages use contract paths, routes are empty, and server-access is present", () => {
    const application = generateApplicationFromContract(petstoreContract).artifact;
    const model = deriveNextHttpModel(petstoreContract, application, { surface: "rsc" });
    const { files } = generateNextDalFromArtifacts(petstoreContract, application, {
      surface: "rsc",
    });

    expect(model.routes).toEqual([]);
    expect(model.uiPages.map((page) => page.filePath)).toEqual(
      expect.arrayContaining(["app/pet/[petId]/page.tsx", "app/store/order/[orderId]/page.tsx"]),
    );
    expect(files.some((file) => file.path === "src/adapters/http-next/server-access.ts")).toBe(
      true,
    );
    expect(files.some((file) => file.path === "src/adapters/http-next/helpers.ts")).toBe(false);
    expect(files.some((file) => file.path === "src/adapters/http-next/controllers.ts")).toBe(false);
  });

  it("when surface is rsc, then generation emits contract-path pages without route handlers", async () => {
    const { files, artifact } = await collectGeneratedFiles(petstoreContract, "rsc");
    const paths = files.map((file) => file.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        "app/layout.tsx",
        "app/page.tsx",
        "app/pet/[petId]/page.tsx",
        "app/store/order/[orderId]/page.tsx",
        "src/adapters/http-next/server-access.ts",
      ]),
    );
    expect(paths.some((path) => path.endsWith("/route.ts"))).toBe(false);
    expect(paths).not.toContain("src/adapters/http-next/helpers.ts");
    expect(paths).not.toContain("src/adapters/http-next/controllers.ts");
    expect(paths).not.toContain("src/adapters/http-next/runtime.ts");
    expect(artifact.routes).toEqual([]);
    expect(artifact.uiPages.map((page) => page.filePath)).toEqual(
      expect.arrayContaining(["app/pet/[petId]/page.tsx", "app/store/order/[orderId]/page.tsx"]),
    );
  });
});

describe("Given a root OpenAPI path", () => {
  it("when surface is both, then route handler, root resource page, and hubs do not collide", async () => {
    const { files } = await collectGeneratedFiles(createRootContract(), "both");
    const filesByPath = fileMap(files);
    const paths = files.map((file) => file.path);
    const rootPage = filesByPath.get("app/ui/page.tsx");

    expect(paths).toContain("app/route.ts");
    expect(paths).not.toContain("app/page.tsx");
    expect(countPath(paths, "app/ui/page.tsx")).toBe(1);
    expect(rootPage?.contents).toContain("const result = await access.getRootResource();");
    expect(rootPage?.contents).not.toContain("<ul>");
    expectNoPageRouteCollisions(paths);
  });

  it("when surface is routes, then the generated API-only hub does not collide with app route", async () => {
    const { files } = await collectGeneratedFiles(createRootContract(), "routes");
    const paths = files.map((file) => file.path);

    expect(paths).toContain("app/route.ts");
    expect(paths).not.toContain("app/page.tsx");
    expectNoPageRouteCollisions(paths);
  });

  it("when surface is rsc, then the root resource page wins over the root hub", async () => {
    const { files } = await collectGeneratedFiles(createRootContract(), "rsc");
    const filesByPath = fileMap(files);
    const paths = files.map((file) => file.path);
    const rootPage = filesByPath.get("app/page.tsx");

    expect(paths).not.toContain("app/route.ts");
    expect(countPath(paths, "app/page.tsx")).toBe(1);
    expect(rootPage?.contents).toContain("const result = await access.getRootResource();");
    expect(rootPage?.contents).not.toContain("<ul>");
  });
});

describe("Given ContractArtifact + ApplicationArtifact with secured operations", () => {
  it("when surface is both, then secured GET ops omit resource pages while routes and unsecured GET pages remain", async () => {
    const application = generateApplicationFromContract(createSecuredContract()).artifact;
    const model = deriveNextHttpModel(createSecuredContract(), application, { surface: "both" });
    const { files } = await collectGeneratedFiles(createSecuredContract(), "both");
    const paths = files.map((file) => file.path);
    const filesByPath = fileMap(files);

    expect(model.uiPages.map((page) => page.operationId)).toEqual(["getPublicCatalog"]);
    expect(paths).not.toContain("app/ui/items/[itemId]/page.tsx");
    expect(paths).toContain("app/ui/catalog/page.tsx");
    expect(paths).toContain("app/items/[itemId]/route.ts");
    expect(filesByPath.get("app/ui/catalog/page.tsx")?.contents).toContain(
      "access.getPublicCatalog(",
    );
    expectNoPageRouteCollisions(paths);
  });

  it("when surface is rsc, then secured GET ops omit resource pages while unsecured GET pages remain", async () => {
    const application = generateApplicationFromContract(createSecuredContract()).artifact;
    const model = deriveNextHttpModel(createSecuredContract(), application, { surface: "rsc" });
    const { files } = await collectGeneratedFiles(createSecuredContract(), "rsc");
    const paths = files.map((file) => file.path);

    expect(model.uiPages.map((page) => page.operationId)).toEqual(["getPublicCatalog"]);
    expect(paths).not.toContain("app/items/[itemId]/page.tsx");
    expect(paths).toContain("app/catalog/page.tsx");
    expect(paths).not.toContain("app/items/[itemId]/route.ts");
  });

  it("when Next route handlers are generated, then secured methods authenticate and pass Principal", async () => {
    const { files } = await collectGeneratedFiles(createSecuredContract(), "routes");
    const createRoute = fileMap(files).get("app/items/route.ts");
    const listRoute = fileMap(files).get("app/items/[itemId]/route.ts");
    const helpers = fileMap(files).get("src/adapters/http-next/helpers.ts");
    const runtime = fileMap(files).get("src/adapters/http-next/runtime.ts");

    expect(helpers?.contents).toContain(
      'import type { AuthCredentials } from "../../core/ports/authenticator.ts";',
    );
    expect(helpers?.contents).toContain("type SecuritySchemeMeta =");
    expect(helpers?.contents).toContain("export function extractCredentials(");
    expect(helpers?.contents).toContain("/^Bearer\\s+(.+)$/i.exec(value.trim())");
    expect(runtime?.contents).toContain("authenticator: Authenticator;");
    expect(runtime?.contents).toContain("authenticator,");
    expect(runtime?.contents).toContain(
      'apiKeys: new Map([["x-internal-key", new Set((process.env.AUTH_API_KEYS ?? "test-key").split(","))]]),',
    );

    expect(createRoute?.contents).toContain("extractCredentials(request.headers, {");
    expect(createRoute?.contents).toContain(
      '{ name: "internalKey", type: "apiKey", headerName: "X-Internal-Key" }',
    );
    expect(createRoute?.contents).toContain(
      'throw new AuthenticationError("credentials-missing");',
    );
    expect(createRoute?.contents).toContain(
      "const principal = await runtime.authenticator.authenticate(credentials);",
    );
    expect(createRoute?.contents).toContain('throw new AuthenticationError("principal-missing");');
    expect(createRoute?.contents).toContain(
      "const result = await runtime.controllers.createItem(apicalRequest, principal);",
    );
    expect(listRoute?.contents).toContain(
      '{ name: "adminBearer", type: "http", scheme: "bearer", headerName: "Authorization" }',
    );
    expect(listRoute?.contents).toContain(
      "const result = await runtime.controllers.listItems(apicalRequest, principal);",
    );
  });
});

describe("Given ContractArtifact + ApplicationArtifact for Library", () => {
  it("when generation runs, then it emits book paths without Petstore output in generated output or plugin source", async () => {
    const application = generateApplicationFromContract(libraryContract).artifact;
    const model = deriveNextHttpModel(libraryContract, application, { surface: "both" });
    const { files } = await collectGeneratedFiles(libraryContract, "both");
    const generatedSource = files.map((file) => file.contents).join("\n");
    const paths = files.map((file) => file.path);

    expect(model.routes.map((route) => route.openApiPath)).toEqual(
      expect.arrayContaining(["/books", "/books/{bookId}"]),
    );
    expect(model.uiPages).toEqual([
      expect.objectContaining({
        filePath: "app/ui/books/[bookId]/page.tsx",
        operationId: "getBook",
        useCaseAccessorName: "getBook",
        paramNames: ["bookId"],
      }),
    ]);
    expect(generatedSource).not.toMatch(/\bPet\b|\bOrder\b|petstore|addPet|placeOrder/);
    expect(generatedSource).toContain("getBook:");
    expect(generatedSource).toContain("createBook:");
    expect(readProductionSources()).not.toMatch(
      /\bPet\b|\bOrder\b|petstore|addPet|updatePet|getPetById|deletePet|placeOrder|getOrderById|deleteOrder|\/pet|\/store\/order/,
    );
    expect(paths).toEqual(
      expect.arrayContaining([
        "app/books/route.ts",
        "app/books/[bookId]/route.ts",
        "app/ui/books/[bookId]/page.tsx",
      ]),
    );
    expect(fileMap(files).get("app/books/[bookId]/route.ts")?.contents).toContain(
      "runtime.controllers.getBook",
    );
    expect(fileMap(files).get("app/ui/books/[bookId]/page.tsx")?.contents).toContain(
      "access.getBook(",
    );
  });
});

describe("Given generated server-access", () => {
  it("when emitted, then getServerAccess exposes one accessor per operationId", () => {
    const application = generateApplicationFromContract(libraryContract).artifact;
    const { files } = generateNextDalFromArtifacts(libraryContract, application, {
      surface: "routes",
    });
    const serverAccess = files.find(
      (file) => file.path === "src/adapters/http-next/server-access.ts",
    );

    expect(serverAccess?.contents).toContain("export function getServerAccess()");
    expect(serverAccess?.contents).toContain("createBook:");
    expect(serverAccess?.contents).toContain("getBook:");
    expect(serverAccess?.contents).toContain("export type ServerAccess = {");
  });
});

describe("Given generated route helpers without security", () => {
  it("when emitted, then they omit auth-only imports and credential helpers", () => {
    const application = generateApplicationFromContract(libraryContract).artifact;
    const { files } = generateNextDalFromArtifacts(libraryContract, application, {
      surface: "routes",
    });
    const helpers = fileMap(files).get("src/adapters/http-next/helpers.ts");

    expect(helpers?.contents).not.toContain("AuthenticationError");
    expect(helpers?.contents).not.toContain("AuthCredentials");
    expect(helpers?.contents).not.toContain("extractCredentials");
  });
});
