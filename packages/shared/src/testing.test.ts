import { describe, expect, it } from "vite-plus/test";

import { createArtifactKey, type HexkitPlugin } from "@hexkit/plugin-api";

import { collectPluginOutput, createCollectingContext, loadNormalizedContract } from "./testing.ts";

const libraryOpenApi = new URL("../../../apps/fixtures/library-api/openapi.yaml", import.meta.url)
  .pathname;

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

const FIXTURE_ARTIFACT = createArtifactKey<{ readonly id: string }>("fixture-id");

function fileWriterPlugin(name = "file-writer"): HexkitPlugin {
  return {
    name,
    generate(context) {
      context.log("writing");
      const artifact = context.artifacts.require(FIXTURE_ARTIFACT);
      context.writeFile({
        path: `${artifact.id}.ts`,
        contents: "export {}",
        ownership: "generated",
      });
    },
  };
}

describe("Given createCollectingContext", () => {
  it("when options are omitted, then it uses the in-memory defaults", () => {
    const { context, files } = createCollectingContext();

    expect(context.inputPath).toBe("openapi.yaml");
    expect(context.outputDirectory).toBe("/tmp/generated-app");
    expect(files).toEqual([]);
  });

  it("when options are provided, then they override input and output paths", () => {
    const { context } = createCollectingContext({
      inputPath: "contract.yaml",
      outputDirectory: "/tmp/custom-out",
    });

    expect(context.inputPath).toBe("contract.yaml");
    expect(context.outputDirectory).toBe("/tmp/custom-out");
  });

  it("when writeFile and log run, then files accumulate and log is a no-op", () => {
    const { context, files } = createCollectingContext();

    context.log("ignored");
    context.writeFile({
      path: "first.ts",
      contents: "a",
      ownership: "generated",
    });
    context.writeFile({
      path: "second.ts",
      contents: "b",
      ownership: "protected",
    });

    expect(files).toEqual([
      { path: "first.ts", contents: "a", ownership: "generated" },
      { path: "second.ts", contents: "b", ownership: "protected" },
    ]);
  });
});

describe("Given collectPluginOutput", () => {
  it("when setup publishes artifacts, then generate sees them and files are recorded", async () => {
    const { context, files } = await collectPluginOutput(fileWriterPlugin(), (generation) => {
      generation.artifacts.publish(FIXTURE_ARTIFACT, { id: "alpha" });
    });

    expect(files.map((file) => file.path)).toEqual(["alpha.ts"]);
    expect(context.artifacts.require(FIXTURE_ARTIFACT).id).toBe("alpha");
  });

  it("when setup is omitted and the plugin writes without artifacts, then files are still recorded", async () => {
    const plugin: HexkitPlugin = {
      name: "no-setup",
      async generate(context) {
        context.writeFile({
          path: "plain.ts",
          contents: "export {}",
          ownership: "generated",
        });
      },
    };

    const { files } = await collectPluginOutput(plugin);

    expect(files).toEqual([{ path: "plain.ts", contents: "export {}", ownership: "generated" }]);
  });

  it("when custom options are passed, then the context keeps those paths", async () => {
    const plugin: HexkitPlugin = {
      name: "paths",
      generate() {},
    };

    const { context } = await collectPluginOutput(plugin, undefined, {
      inputPath: "in.yaml",
      outputDirectory: "/tmp/plugin-out",
    });

    expect(context.inputPath).toBe("in.yaml");
    expect(context.outputDirectory).toBe("/tmp/plugin-out");
  });
});

describe("Given loadNormalizedContract", () => {
  it("when a library-shaped OpenAPI file is loaded, then operations follow the module map", async () => {
    const contract = await loadNormalizedContract(libraryOpenApi, libraryModules);

    expect(contract.application.title).toBe("Hexkit Library API");
    expect(contract.operations.map((operation) => operation.operationId)).toEqual([
      "createBook",
      "getBook",
    ]);
    expect(contract.schemas.map((schema) => schema.name)).toEqual(["Author", "Book"]);
  });
});
