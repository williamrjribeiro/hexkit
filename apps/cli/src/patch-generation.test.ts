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

const patchContractPath = new URL("../../fixtures/patch-api/openapi.yaml", import.meta.url)
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

async function generateInto(outputDirectory: string): Promise<void> {
  await generateApplication(patchContractPath, outputDirectory, {
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

describe("Given the patch-api fixture", () => {
  it("when generated, then update operations wire through use cases and drizzle field patches", async () => {
    const outputDirectory = createOutputDirectory("hexkit-patch-api-");
    await generateInto(outputDirectory);

    const repository = readFileSync(
      join(outputDirectory, "src/adapters/db/widget-repository.ts"),
      "utf8",
    );
    const useCase = readFileSync(
      join(outputDirectory, "src/core/application/update-widget-with-form.ts"),
      "utf8",
    );
    const files = readdirSync(join(outputDirectory, "src/generated/contracts/routes"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(outputDirectory, join(entry.parentPath, entry.name)));

    expect(useCase).toContain("updateWidgetWithForm");
    expect(useCase).toContain("string | undefined");
    expect(repository).toContain("updateWidgetWithForm");
    expect(repository).toContain("const patch");
    expect(files).toContain("src/generated/contracts/routes/updateWidgetWithForm.ts");
  });
});
