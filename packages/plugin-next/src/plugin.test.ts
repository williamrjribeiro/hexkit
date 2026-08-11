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
