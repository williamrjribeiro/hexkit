import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vite-plus/test";

import { generateApplicationFromContract } from "@hexkit/plugin-architecture-hexagonal";
import {
  loadValidatedOpenApi,
  normalizeContractArtifact,
  type ContractArtifact,
} from "@hexkit/plugin-apical";

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

const productionSourceRoots = ["artifact.ts", "generate", "model", "index.ts"];

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
});

describe("Given ContractArtifact + ApplicationArtifact for Library", () => {
  it("when generation runs, then it emits book paths without Petstore output in plugin source", () => {
    const application = generateApplicationFromContract(libraryContract).artifact;
    const model = deriveNextHttpModel(libraryContract, application, { surface: "both" });
    const { files } = generateNextDalFromArtifacts(libraryContract, application, {
      surface: "both",
    });
    const generatedSource = files.map((file) => file.contents).join("\n");

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
