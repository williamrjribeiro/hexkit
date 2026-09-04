import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { generateApplication } from "./main.ts";

describe("Given the headers-api fixture", () => {
  const headersContractPath = new URL("../../fixtures/headers-api/openapi.yaml", import.meta.url)
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
    await generateApplication(headersContractPath, outputDirectory, {
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

  it("when generated, then success response headers envelope through use case, stub, controller, and Hono respond", async () => {
    const outputDirectory = createOutputDirectory("hexkit-headers-api-");
    await generateInto(outputDirectory);

    const port = readFileSync(join(outputDirectory, "src/core/ports/widget-repository.ts"), "utf8");
    const repository = readFileSync(
      join(outputDirectory, "src/adapters/db/widget-repository.ts"),
      "utf8",
    );
    const controllers = readFileSync(
      join(outputDirectory, "src/adapters/http/controllers.ts"),
      "utf8",
    );
    const routes = readFileSync(join(outputDirectory, "src/adapters/http/routes.ts"), "utf8");
    const getWidget = readFileSync(
      join(outputDirectory, "src/core/ports/widget-repository.ts"),
      "utf8",
    );

    expect(port).toContain(
      'issueWidgetToken(label: string): Promise<{ data: string; headers: { "x-rate-limit": number; "x-expires-after": string } }>',
    );
    expect(repository).toContain("async issueWidgetToken()");
    expect(port).toContain("getWidgetById(id: string): Promise<Widget | undefined>");
    expect(repository).toContain(
      'return { data: "", headers: { "x-rate-limit": 0, "x-expires-after": "" } }',
    );
    expect(controllers).toContain(
      'data: issueWidgetTokenResponseMap["200"]["application/json"].parse(result.data),',
    );
    expect(controllers).toContain("headers: result.headers,");
    expect(controllers).toContain(
      'data: getWidgetByIdResponseMap["200"]["application/json"].parse(result),',
    );
    expect(routes).toContain("headers[name] = String(value)");
    expect(getWidget).not.toContain("getWidgetById(id: string): Promise<{ data:");
  });
});
