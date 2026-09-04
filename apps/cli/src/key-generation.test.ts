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

const keyContractPath = new URL("../../fixtures/key-api/openapi.yaml", import.meta.url).pathname;

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
  await generateApplication(keyContractPath, outputDirectory, {
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

describe("Given the key-api fixture", () => {
  it("when generated, then keyed lookup, path+body update, boolean delete, array insert, and stubs emit", async () => {
    const outputDirectory = createOutputDirectory("hexkit-key-api-");
    await generateInto(outputDirectory);

    const repository = readFileSync(
      join(outputDirectory, "src/adapters/db/widget-repository.ts"),
      "utf8",
    );
    const controllers = readFileSync(
      join(outputDirectory, "src/adapters/http/controllers.ts"),
      "utf8",
    );
    const routes = readFileSync(join(outputDirectory, "src/adapters/http/routes.ts"), "utf8");
    const updateUseCase = readFileSync(
      join(outputDirectory, "src/core/application/update-widget-by-sku.ts"),
      "utf8",
    );
    const files = readdirSync(join(outputDirectory, "src/generated/contracts/routes"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(outputDirectory, join(entry.parentPath, entry.name)));

    expect(repository).toContain("eq(widgets.sku, sku)");
    expect(repository).toContain("return row !== undefined");
    expect(repository).toContain(".values(body).returning()");
    expect(repository).toContain("return;");
    expect(repository).toContain('return ""');
    expect(repository).toContain("eq(widgets.sku, sku)");
    expect(updateUseCase).toContain("sku: string, widget: Widget");
    expect(controllers).toContain("request.value.path.sku, request.value.body");
    expect(routes.indexOf('app.get("/widgets/logout"')).toBeLessThan(
      routes.indexOf('app.get("/widgets/:sku"'),
    );
    expect(files).toEqual(
      expect.arrayContaining([
        "src/generated/contracts/routes/getWidgetBySku.ts",
        "src/generated/contracts/routes/updateWidgetBySku.ts",
        "src/generated/contracts/routes/createWidgets.ts",
      ]),
    );
  });
});
