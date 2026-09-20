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

import type { HttpAdapter } from "./command.ts";
import { generateApplication } from "./main.ts";

const uploadContractPath = new URL("../../fixtures/upload-api/openapi.yaml", import.meta.url)
  .pathname;

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

async function generateInto(outputDirectory: string, http: HttpAdapter): Promise<void> {
  await generateApplication(uploadContractPath, outputDirectory, {
    http,
    nextSurface: http === "next" ? "routes" : undefined,
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

function expectUploadFoundation(outputDirectory: string): void {
  const paths = listFiles(outputDirectory);
  const useCase = readFileSync(
    join(outputDirectory, "src/core/application/upload-document.ts"),
    "utf8",
  );

  expect(paths).toEqual(
    expect.arrayContaining([
      "src/core/ports/blob-store.ts",
      "src/adapters/persistence/drizzle-blob-store.ts",
      "src/core/application/upload-document.ts",
    ]),
  );
  expect(useCase).toContain("export function createUploadDocument(");
  expect(useCase).toContain("blobs: BlobStore");
  expect(useCase).toContain("documents: DocumentRepository");
}

describe("Given the upload-api fixture", () => {
  it("when generated with Hono, then upload storage and the POST route are emitted", async () => {
    const outputDirectory = createOutputDirectory("hexkit-upload-hono-");
    await generateInto(outputDirectory, "hono");

    expectUploadFoundation(outputDirectory);
    const routes = readFileSync(join(outputDirectory, "src/adapters/http/routes.ts"), "utf8");
    expect(routes).toContain('app.post("/widgets/:widgetId/documents"');
  });

  it("when generated with Next, then upload storage and the POST route are emitted", async () => {
    const outputDirectory = createOutputDirectory("hexkit-upload-next-");
    await generateInto(outputDirectory, "next");

    expectUploadFoundation(outputDirectory);
    const routePath = "app/widgets/[widgetId]/documents/route.ts";
    expect(listFiles(outputDirectory)).toContain(routePath);
    expect(readFileSync(join(outputDirectory, routePath), "utf8")).toContain(
      "export async function POST(",
    );
  });
});
