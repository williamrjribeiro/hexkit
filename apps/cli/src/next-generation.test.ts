import { join, relative } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import type { FileWriterActions } from "@hexkit/core";
import { loadValidatedOpenApi } from "@hexkit/plugin-apical";

import { main } from "./main.ts";

const petstoreContract = new URL("../../petstore-sample/openapi.poc.yaml", import.meta.url);

const petstoreApicalContractPaths = [
  "package.json",
  "routes/addPet.ts",
  "routes/deleteOrder.ts",
  "routes/deletePet.ts",
  "routes/getOrderById.ts",
  "routes/getPetById.ts",
  "routes/index.ts",
  "routes/placeOrder.ts",
  "routes/updatePet.ts",
  "schemas/Order.ts",
  "schemas/Pet.ts",
  "schemas/addPetParameters.ts",
  "schemas/deleteOrderParameters.ts",
  "schemas/deletePetParameters.ts",
  "schemas/getOrderByIdParameters.ts",
  "schemas/getPetByIdParameters.ts",
  "schemas/index.ts",
  "schemas/placeOrderParameters.ts",
  "schemas/runtime.ts",
  "schemas/updatePetParameters.ts",
  "server/addPet.ts",
  "server/deleteOrder.ts",
  "server/deletePet.ts",
  "server/getOrderById.ts",
  "server/getPetById.ts",
  "server/index.ts",
  "server/placeOrder.ts",
  "server/updatePet.ts",
  "standard-schema.ts",
  "tsconfig.json",
] as const;

const petstoreSchemasIndex = `
import { Order } from "./Order.ts";
import { Pet } from "./Pet.ts";
export { Order, Pet };
`;

const petstoreRoutesIndex = `
import { serverRoute as addPetRoute } from "./addPet.ts";
import { serverRoute as updatePetRoute } from "./updatePet.ts";
import { serverRoute as getPetByIdRoute } from "./getPetById.ts";
import { serverRoute as deletePetRoute } from "./deletePet.ts";
import { serverRoute as placeOrderRoute } from "./placeOrder.ts";
import { serverRoute as getOrderByIdRoute } from "./getOrderById.ts";
import { serverRoute as deleteOrderRoute } from "./deleteOrder.ts";
export const routes = {
  addPet: addPetRoute,
  updatePet: updatePetRoute,
  getPetById: getPetByIdRoute,
  deletePet: deletePetRoute,
  placeOrder: placeOrderRoute,
  getOrderById: getOrderByIdRoute,
  deleteOrder: deleteOrderRoute,
} as const;
`;

async function runPetstoreNextGeneration(arguments_: readonly string[]): Promise<{
  exitCode: number;
  files: Map<string, string>;
  outputDirectory: string;
}> {
  const outputDirectory = "/virtual/generated-next-petstore";
  const files = new Map<string, string>();
  const actions: FileWriterActions = {
    exists(path: string) {
      return files.has(path);
    },
    write(path: string, contents: string) {
      files.set(path, contents);
    },
    log() {},
  };

  const exitCode = await main(["generate", "petstore.yaml", outputDirectory, ...arguments_], {
    actions,
    inputExists: (path: string) => path === "petstore.yaml",
    log() {},
    apical: {
      async runCraft(craftArguments: readonly string[]) {
        const outputFlag = craftArguments.indexOf("-o");
        const contractsDirectory = craftArguments[outputFlag + 1];
        if (!contractsDirectory) throw new Error("Craft output argument is missing");

        for (const path of petstoreApicalContractPaths) {
          const contents =
            path === "schemas/index.ts"
              ? petstoreSchemasIndex
              : path === "routes/index.ts"
                ? petstoreRoutesIndex
                : "";
          actions.write(join(contractsDirectory, path), contents);
        }
      },
      loadOpenApi: () => loadValidatedOpenApi(petstoreContract.pathname),
      async readGeneratedFile(path) {
        const contents = files.get(path);
        if (contents === undefined) {
          throw new Error(`Missing virtual Apical output: ${path}`);
        }
        return contents;
      },
    },
  });

  return { exitCode, files, outputDirectory };
}

function generatedPaths(result: { files: Map<string, string>; outputDirectory: string }): string[] {
  return [...result.files.keys()].map((path) => relative(result.outputDirectory, path)).sort();
}

function generatedFile(
  result: { files: Map<string, string>; outputDirectory: string },
  path: string,
): string {
  return result.files.get(join(result.outputDirectory, path)) ?? "";
}

describe("Given Next.js CLI generation", () => {
  it("when --http next is passed without a surface, then both route handlers and UI pages are emitted", async () => {
    const result = await runPetstoreNextGeneration(["--http", "next"]);
    const paths = generatedPaths(result);

    expect(result.exitCode).toBe(0);
    expect(paths).toEqual(
      expect.arrayContaining([
        "app/pet/[petId]/route.ts",
        "app/ui/pet/[petId]/page.tsx",
        "src/adapters/http-next/server-access.ts",
        "src/adapters/db/database.ts",
      ]),
    );
  });

  it("when --next-surface routes is passed with --http next, then handlers and server access emit without UI scaffolds", async () => {
    const result = await runPetstoreNextGeneration(["--http", "next", "--next-surface", "routes"]);
    const paths = generatedPaths(result);
    const manifest = JSON.parse(generatedFile(result, "package.json")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const database = generatedFile(result, "src/adapters/db/database.ts");
    const dockerfile = generatedFile(result, "Dockerfile");
    const compose = generatedFile(result, "docker-compose.yml");
    const startScript = generatedFile(result, "scripts/start.sh");

    expect(result.exitCode).toBe(0);
    expect(paths).toEqual(
      expect.arrayContaining([
        "app/layout.tsx",
        "app/page.tsx",
        "app/pet/[petId]/route.ts",
        "next.config.ts",
        "eslint.config.mjs",
        "tsconfig.json",
        "Dockerfile",
        "docker-compose.yml",
        "src/adapters/http-next/server-access.ts",
        "src/adapters/http-next/runtime.ts",
        "src/adapters/db/database.ts",
      ]),
    );
    expect(paths.some((path) => path.startsWith("app/ui/"))).toBe(false);
    expect(paths).not.toContain("src/runtime/server.ts");
    expect(manifest.scripts).toMatchObject({
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "eslint . --max-warnings 0",
    });
    expect(manifest.dependencies).toEqual(
      expect.objectContaining({
        "drizzle-orm": expect.any(String),
        next: expect.any(String),
        pg: expect.any(String),
        react: expect.any(String),
        "react-dom": expect.any(String),
      }),
    );
    expect(manifest.devDependencies).toEqual(
      expect.objectContaining({
        eslint: expect.any(String),
        "eslint-config-next": "16.3.0",
      }),
    );
    expect(generatedFile(result, "eslint.config.mjs")).toContain(
      "eslint-config-next/core-web-vitals",
    );
    expect(generatedFile(result, "eslint.config.mjs")).toContain("eslint-config-next/typescript");
    expect(generatedFile(result, "eslint.config.mjs")).toContain(
      "@next/next/no-html-link-for-pages",
    );
    expect(database).toContain('import { drizzle } from "drizzle-orm/node-postgres";');
    expect(database).toContain("export function getDatabase()");
    expect(dockerfile).toContain("RUN pnpm install\n");
    expect(dockerfile).toContain("pnpm build");
    expect(compose).toMatchInlineSnapshot(`
      "services:
        postgres:
          image: postgres:17-alpine
          environment:
            POSTGRES_DB: \${POSTGRES_DB:-hexkit_petstore_poc}
            POSTGRES_USER: \${POSTGRES_USER:-hexkit_petstore_poc}
            POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-hexkit_petstore_poc}
          healthcheck:
            test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
            interval: 2s
            timeout: 5s
            retries: 15
          volumes:
            - postgres-data:/var/lib/postgresql/data

        next:
          build: .
          environment:
            DATABASE_URL: postgres://\${POSTGRES_USER:-hexkit_petstore_poc}:\${POSTGRES_PASSWORD:-hexkit_petstore_poc}@postgres:5432/\${POSTGRES_DB:-hexkit_petstore_poc}
            HOSTNAME: "0.0.0.0"
            PORT: "3000"
          depends_on:
            postgres:
              condition: service_healthy
          ports:
            - "3000:3000"
          healthcheck:
            test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/"]
            interval: 2s
            timeout: 5s
            retries: 30
            start_period: 45s

      volumes:
        postgres-data:
      "
    `);
    expect(startScript).toContain("pnpm run migrate");
    expect(startScript).toContain("exec pnpm exec next start --hostname 0.0.0.0 --port");
    const tsconfig = JSON.parse(generatedFile(result, "tsconfig.json")) as {
      compilerOptions: { baseUrl?: string; jsx?: string; paths?: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions.baseUrl).toBeUndefined();
    expect(tsconfig.compilerOptions.jsx).toBe("react-jsx");
    expect(tsconfig.compilerOptions.paths?.["@/*"]).toEqual(["./src/*"]);
  });

  it("when --next-surface rsc is passed with --http next, then only RSC pages emit at contract paths plus server access", async () => {
    const result = await runPetstoreNextGeneration(["--http", "next", "--next-surface", "rsc"]);
    const paths = generatedPaths(result);

    expect(result.exitCode).toBe(0);
    expect(paths).toEqual(
      expect.arrayContaining([
        "app/pet/[petId]/page.tsx",
        "app/store/order/[orderId]/page.tsx",
        "src/adapters/http-next/server-access.ts",
        "src/adapters/db/database.ts",
      ]),
    );
    expect(paths.some((path) => path.endsWith("/route.ts"))).toBe(false);
    expect(paths).not.toContain("src/adapters/http-next/runtime.ts");
    expect(paths).not.toContain("src/adapters/http-next/controllers.ts");
    expect(paths).not.toContain("src/runtime/server.ts");
  });
});
