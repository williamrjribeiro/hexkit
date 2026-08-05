import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { generateApplication } from "./main.ts";

const authContractPath = new URL("../../fixtures/auth-api/openapi.yaml", import.meta.url).pathname;

const generatedDirectories: string[] = [];

afterEach(() => {
  for (const directory of generatedDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createOutputDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  generatedDirectories.push(directory);
  return directory;
}

function listFiles(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)];
    })
    .sort();
}

async function generateInto(outputDirectory: string, inputPath = authContractPath): Promise<void> {
  await generateApplication(inputPath, outputDirectory, {
    actions: {
      exists: existsSync,
      write(path: string, contents: string) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, contents, "utf8");
      },
      log() {},
    },
  });
}

describe("Given the Auth fixture contract", () => {
  it("when the real generator runs, then it emits auth-aware artifacts for secured and public operations", async () => {
    const outputDirectory = createOutputDirectory("hexkit-auth-gen-");
    await generateInto(outputDirectory);

    const paths = listFiles(outputDirectory);
    const controllers = readFileSync(
      join(outputDirectory, "src/adapters/http/controllers.ts"),
      "utf8",
    );
    const routes = readFileSync(join(outputDirectory, "src/adapters/http/routes.ts"), "utf8");
    const runtime = readFileSync(join(outputDirectory, "src/runtime/app.ts"), "utf8");
    const authAdapter = readFileSync(
      join(outputDirectory, "src/adapters/auth/in-memory-authenticator.ts"),
      "utf8",
    );
    const createItemUseCase = readFileSync(
      join(outputDirectory, "src/core/application/create-item.ts"),
      "utf8",
    );
    const listItemsUseCase = readFileSync(
      join(outputDirectory, "src/core/application/list-items.ts"),
      "utf8",
    );
    const getHealthUseCase = readFileSync(
      join(outputDirectory, "src/core/application/get-health.ts"),
      "utf8",
    );

    expect(paths).toEqual(
      expect.arrayContaining([
        "src/adapters/auth/in-memory-authenticator.ts",
        "src/adapters/http/controllers.ts",
        "src/adapters/http/routes.ts",
        "src/core/application/create-item.ts",
        "src/core/application/get-health.ts",
        "src/core/application/list-items.ts",
        "src/core/domain/auth-principal.ts",
        "src/core/domain/item.ts",
        "src/core/ports/authenticator.ts",
        "src/core/ports/item-repository.ts",
        "src/runtime/app.ts",
      ]),
    );

    expect(controllers).toContain("AuthenticationError");
    expect(controllers).toContain("const result = await useCases.createItem(principal");
    expect(controllers).toContain("const result = await useCases.listItems(principal");
    expect(controllers).toContain("getHealth: getHealthWrapper(async (request) => {");
    expect(routes).toContain('app.get("/health", async (context) =>');
    expect(routes).toContain('app.get("/items", authenticateListItems, async (context) =>');
    expect(routes).toContain('app.post("/items", authenticateCreateItem, async (context) =>');
    expect(routes).toContain('return context.json({ error: "Unauthorized" }, 401);');
    expect(runtime).toContain(
      'import { createInMemoryAuthenticator } from "../adapters/auth/in-memory-authenticator.ts";',
    );
    expect(runtime).toContain(
      'bearerTokens: new Set((process.env.AUTH_BEARER_TOKENS ?? "test-token").split(",")),',
    );
    expect(runtime).toContain(
      'apiKeys: new Map([["x-api-key", new Set((process.env.AUTH_API_KEYS ?? "test-key").split(","))]]),',
    );
    expect(authAdapter).toContain("export function createInMemoryAuthenticator(options: {");
    expect(createItemUseCase).toContain("principal: Principal");
    expect(listItemsUseCase).toContain("principal: Principal");
    expect(getHealthUseCase).not.toContain("principal: Principal");
    expect(getHealthUseCase).not.toContain("Principal");

    // Future Compose acceptance matrix for this fixture, intentionally not executed here:
    // GET /health without auth -> 200
    // GET /items without Authorization -> 401
    // GET /items with Authorization: Bearer good -> 200
    // GET /items with Authorization: Bearer bad -> 401
    // POST /items with only bearer auth -> 401
    // POST /items with X-API-Key: good -> 201
  }, 120_000);

  it("when an operation is secured only by oauth2, then generation fails instead of emitting a public route", async () => {
    const rootDirectory = createOutputDirectory("hexkit-oauth-only-");
    const inputPath = join(rootDirectory, "openapi.yaml");
    const outputDirectory = join(rootDirectory, "generated");

    writeFileSync(
      inputPath,
      [
        "openapi: 3.1.0",
        "info:",
        "  title: OAuth Only Fixture",
        "  version: 1.0.0",
        "paths:",
        "  /items:",
        "    get:",
        "      operationId: listItems",
        "      x-hexkit:",
        "        operation:",
        "          aggregate: Item",
        "          action: list",
        "      security:",
        "        - implicitOAuth: [read]",
        "      responses:",
        '        "200":',
        "          description: ok",
        "          content:",
        "            application/json:",
        "              schema:",
        "                type: array",
        "                items:",
        '                  $ref: "#/components/schemas/Item"',
        "components:",
        "  schemas:",
        "    Item:",
        "      type: object",
        "      x-hexkit:",
        "        persistence:",
        "          table: items",
        "          identity: id",
        "      required: [id]",
        "      properties:",
        "        id: { type: string }",
        "  securitySchemes:",
        "    implicitOAuth:",
        "      type: oauth2",
        "      flows:",
        "        implicit:",
        "          authorizationUrl: https://example.com/oauth/authorize",
        "          scopes:",
        "            read: read items",
        "",
      ].join("\n"),
    );

    await expect(generateInto(outputDirectory, inputPath)).rejects.toThrow(
      'Operation "listItems" requires OpenAPI security schemes that Hexkit cannot enforce at runtime: implicitOAuth (oauth2).',
    );
  }, 120_000);
});
