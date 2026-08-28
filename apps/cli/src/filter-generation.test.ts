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

const filterContractPath = new URL("../../fixtures/filter-api/openapi.yaml", import.meta.url)
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
  await generateApplication(filterContractPath, outputDirectory, {
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

describe("Given the filter-api fixture", () => {
  it("when generated, then query list operations wire through controllers and drizzle filters", async () => {
    const outputDirectory = createOutputDirectory("hexkit-filter-api-");
    await generateInto(outputDirectory);

    const controllers = readFileSync(
      join(outputDirectory, "src/adapters/http/controllers.ts"),
      "utf8",
    );
    const repository = readFileSync(
      join(outputDirectory, "src/adapters/db/widget-repository.ts"),
      "utf8",
    );
    const useCase = readFileSync(
      join(outputDirectory, "src/core/application/find-widgets-by-status.ts"),
      "utf8",
    );

    expect(controllers).toContain("request.value.query.status");
    expect(repository).toContain("inArray(widgets.status, status)");
    expect(useCase).toContain("findWidgetsByStatus");
    expect(
      readdirSync(join(outputDirectory, "src/generated/contracts/routes"), {
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(outputDirectory, join(entry.parentPath, entry.name))),
    ).toContain("src/generated/contracts/routes/findWidgetsByStatus.ts");
  });
});
