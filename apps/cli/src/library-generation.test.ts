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
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { generateApplication } from "./main.ts";

const libraryContractPath = new URL("../../fixtures/library-api/openapi.yaml", import.meta.url)
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

async function generateInto(
  outputDirectory: string,
  inputPath = libraryContractPath,
): Promise<void> {
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

function typecheckGeneratedApp(outputDirectory: string): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const install = spawnSync("vp", ["install", "--no-frozen-lockfile"], {
    cwd: outputDirectory,
    encoding: "utf8",
  });
  if (install.status !== 0) {
    return {
      status: install.status,
      stdout: install.stdout,
      stderr: install.stderr || "vp install failed",
    };
  }

  const check = spawnSync("vp", ["run", "check"], {
    cwd: outputDirectory,
    encoding: "utf8",
  });

  return {
    status: check.status,
    stdout: check.stdout,
    stderr: check.stderr,
  };
}

describe("Given the Library fixture contract", () => {
  // Follow-up (not required for PoC sign-off): extend this fixture with a nested
  // Book field (JSONB) and/or a Compose + Pactum library dogfood loop so §5.0
  // nested persistence is proven without Petstore. Nested JSONB is covered today
  // by Petstore dogfood + generic Drizzle nested unit tests.
  it("when the real generator runs, then it emits author/book artifacts without Petstore output", async () => {
    const outputDirectory = createOutputDirectory("hexkit-library-gen-");
    await generateInto(outputDirectory);

    const paths = listFiles(outputDirectory);
    const source = paths
      .filter((path) => !path.startsWith("src/generated/contracts/"))
      .map((path) => readFileSync(join(outputDirectory, path), "utf8"))
      .join("\n");
    const manifest = JSON.parse(readFileSync(join(outputDirectory, "package.json"), "utf8")) as {
      name: string;
      scripts: Record<string, string>;
    };

    expect(paths).toEqual(
      expect.arrayContaining([
        "drizzle/0000_hexkit-library-api.sql",
        "src/adapters/db/book-repository.ts",
        "src/adapters/db/schema.ts",
        "src/adapters/http/routes.ts",
        "src/core/application/create-book.ts",
        "src/core/application/get-book.ts",
        "src/core/domain/author.ts",
        "src/core/domain/book.ts",
        "src/core/ports/book-repository.ts",
        "src/generated/contracts/hexkit-contract.json",
        "src/runtime/app.ts",
        "src/runtime/server.ts",
      ]),
    );
    expect(paths).not.toEqual(
      expect.arrayContaining([
        "drizzle/0000_hexkit-petstore-poc.sql",
        "src/adapters/db/pet-repository.ts",
        "src/core/domain/pet.ts",
      ]),
    );
    expect(manifest.name).toBe("generated-hexkit-library-api");
    expect(manifest.scripts.migrate).toContain("drizzle/0000_hexkit-library-api.sql");
    expect(source).toContain('pgTable("authors"');
    expect(source).toContain('pgTable("books"');
    expect(source).toContain(".references(() => authors.id)");
    expect(source).toContain('FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id")');
    expect(source).toContain('app.post("/books"');
    expect(source).not.toMatch(/\bPet\b|\bOrder\b|petstore|addPet|placeOrder/);
  }, 120_000);

  it("when the generated Library app is typechecked, then tsc succeeds", async () => {
    const outputDirectory = createOutputDirectory("hexkit-library-check-");
    await generateInto(outputDirectory);

    expect(typecheckGeneratedApp(outputDirectory)).toEqual({
      status: 0,
      stdout: expect.any(String),
      stderr: "",
    });
  }, 180_000);

  it("when a Library schema and operation are renamed, then generated output follows without plugin edits", async () => {
    const outputDirectory = createOutputDirectory("hexkit-library-rename-");
    const renamedContractPath = join(outputDirectory, "openapi.yaml");
    const original = readFileSync(libraryContractPath, "utf8");
    const renamed = original
      .replaceAll("createBook", "createVolume")
      .replaceAll("getBook", "getVolume")
      .replaceAll("bookId", "volumeId")
      .replaceAll("BookId", "VolumeId")
      .replaceAll("/books", "/volumes")
      .replaceAll("Book", "Volume")
      .replaceAll("books", "volumes")
      .replaceAll("book", "volume");

    writeFileSync(renamedContractPath, renamed, "utf8");
    await generateInto(outputDirectory, renamedContractPath);

    const paths = listFiles(outputDirectory);
    const source = paths
      .filter((path) => !path.startsWith("src/generated/contracts/"))
      .map((path) => readFileSync(join(outputDirectory, path), "utf8"))
      .join("\n");

    expect(paths).toEqual(
      expect.arrayContaining([
        "src/core/domain/volume.ts",
        "src/core/ports/volume-repository.ts",
        "src/core/application/create-volume.ts",
        "src/core/application/get-volume.ts",
        "src/adapters/db/volume-repository.ts",
        "src/generated/contracts/routes/createVolume.ts",
        "src/generated/contracts/schemas/Volume.ts",
      ]),
    );
    expect(paths).not.toEqual(
      expect.arrayContaining([
        "src/core/domain/book.ts",
        "src/core/application/create-book.ts",
        "src/adapters/db/book-repository.ts",
      ]),
    );
    expect(source).toContain('pgTable("volumes"');
    expect(source).toContain('app.post("/volumes"');
    expect(source).toContain("createVolume");
    expect(source).not.toMatch(/\bBook\b|createBook|\/books/);
  }, 120_000);
});
