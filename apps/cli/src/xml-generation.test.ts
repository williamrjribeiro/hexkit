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
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import type { HttpAdapter } from "./command.ts";
import { generateApplication } from "./main.ts";

const xmlContractPath = new URL("../../fixtures/xml-api/openapi.yaml", import.meta.url).pathname;

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
      if (entry.isDirectory()) return listFiles(root, path);
      return [path.slice(root.length + 1)];
    })
    .toSorted();
}

async function generateInto(outputDirectory: string, http: HttpAdapter): Promise<void> {
  await generateApplication(xmlContractPath, outputDirectory, {
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

function readGenerated(outputDirectory: string, relativePath: string): string {
  return readFileSync(join(outputDirectory, relativePath), "utf8");
}

function readManifestDependencies(outputDirectory: string): Record<string, string> {
  const manifest = JSON.parse(readGenerated(outputDirectory, "package.json")) as {
    dependencies: Record<string, string>;
  };
  return manifest.dependencies;
}

describe("Given the xml-api fixture", () => {
  it("when generated with Hono, then the XML runtime, request helpers, and dependency are emitted", async () => {
    const outputDirectory = createOutputDirectory("hexkit-xml-hono-");
    await generateInto(outputDirectory, "hono");

    expect(listFiles(outputDirectory)).toEqual(
      expect.arrayContaining([
        "src/adapters/http/routes.ts",
        "src/adapters/http/controllers.ts",
        "src/core/application/create-widget.ts",
        "src/core/application/get-widget-by-id.ts",
        "src/core/application/set-widget-label.ts",
      ]),
    );

    const routes = readGenerated(outputDirectory, "src/adapters/http/routes.ts");
    expect(routes).toContain('import { XMLBuilder, XMLParser } from "fast-xml-parser";');
    expect(routes).toContain("function parseXmlPayload(text: string): unknown");
    expect(routes).toContain(
      `await typedRequest(context, ["application/json"], ["application/xml"], [])`,
    );
    expect(routes).toContain(`await xmlRequest(context, ["application/xml"], [])`);
    expect(routes).toContain(
      'respond(await controllers.getWidgetById(request(context, [])), context.req.header("accept"))',
    );

    const controllers = readGenerated(outputDirectory, "src/adapters/http/controllers.ts");
    expect(controllers).toContain('xmlRoot: "Widget",');
    expect(controllers).toContain("if (!request.isValid || !request.value.body)");

    const xmlOnlyUseCase = readGenerated(
      outputDirectory,
      "src/core/application/set-widget-label.ts",
    );
    expect(xmlOnlyUseCase).toContain("label: Label");

    expect(readManifestDependencies(outputDirectory)).toMatchObject({
      "fast-xml-parser": "5.11.2",
    });
  });

  it("when generated with Next, then helpers negotiate XML and handlers pass the Accept header", async () => {
    const outputDirectory = createOutputDirectory("hexkit-xml-next-");
    await generateInto(outputDirectory, "next");

    const helpers = readGenerated(outputDirectory, "src/adapters/http-next/helpers.ts");
    expect(helpers).toContain('import { XMLBuilder, XMLParser } from "fast-xml-parser";');
    expect(helpers).toContain("function parseXmlPayload(text: string): unknown");
    expect(helpers).toContain("if (options.xmlBody) {");
    expect(helpers).toContain(
      "if (result.xmlRoot !== undefined && prefersXmlResponse(accept ?? undefined))",
    );

    const routes = listFiles(outputDirectory).filter(
      (path) => path.startsWith("app/") && path.endsWith("/route.ts"),
    );
    expect(routes).toContain("app/widgets/route.ts");
    expect(routes).toContain("app/widgets/[widgetId]/label/route.ts");

    const postRoute = readGenerated(outputDirectory, "app/widgets/route.ts");
    expect(postRoute).toContain(
      `toApicalRequest(request, params, { jsonBody: true, xmlContentTypes: ["application/xml"], arrayQueryKeys: [] })`,
    );
    expect(postRoute).toContain('handleControllerResult(result, request.headers.get("accept"))');

    const putRoute = readGenerated(outputDirectory, "app/widgets/[widgetId]/label/route.ts");
    expect(putRoute).toContain(
      `toApicalRequest(request, params, { jsonBody: false, xmlBody: true, contentTypes: ["application/xml"], arrayQueryKeys: [] })`,
    );

    expect(readManifestDependencies(outputDirectory)).toMatchObject({
      "fast-xml-parser": "5.11.2",
    });
  });
});
