import { describe, expect, expectTypeOf, it } from "vite-plus/test";

import {
  createArtifactKey,
  createArtifactRegistry,
  DuplicateArtifactError,
  MissingArtifactError,
} from "./contracts.ts";
import type { ArtifactKey, GeneratedFile, GenerationContext, HexkitPlugin } from "./contracts.ts";

describe("Given the framework-agnostic plugin contracts", () => {
  it("when a plugin generates output, then the context receives the declared file", async () => {
    const files: GeneratedFile[] = [];
    const messages: string[] = [];
    const plugin: HexkitPlugin = {
      name: "example",
      async generate(context: GenerationContext) {
        await Promise.resolve();
        context.writeFile({
          path: "src/example.ts",
          contents: "export const example = true;\n",
          ownership: "generated",
        });
        context.log("example generated");
      },
    };
    const context: GenerationContext = {
      inputPath: "openapi.yaml",
      outputDirectory: "generated-app",
      artifacts: createArtifactRegistry(),
      writeFile(file: GeneratedFile) {
        files.push(file);
      },
      log(message: string) {
        messages.push(message);
      },
    };

    await plugin.generate(context);

    expect(files).toEqual([
      {
        path: "src/example.ts",
        contents: "export const example = true;\n",
        ownership: "generated",
      },
    ]);
    expect(messages).toEqual(["example generated"]);
    expectTypeOf<GeneratedFile["ownership"]>().toEqualTypeOf<"generated" | "protected">();
  });
});

describe("Given a typed artifact registry", () => {
  type ExampleArtifact = {
    value: string;
  };

  const exampleArtifactKey: ArtifactKey<ExampleArtifact> =
    createArtifactKey<ExampleArtifact>("example");

  it("publishes and requires an artifact with its exact type", () => {
    const registry = createArtifactRegistry();
    const artifact: ExampleArtifact = { value: "published" };

    registry.publish(exampleArtifactKey, artifact);

    expect(registry.require(exampleArtifactKey)).toBe(artifact);
    expectTypeOf(registry.require(exampleArtifactKey)).toEqualTypeOf<ExampleArtifact>();
  });

  it("rejects duplicate publication by stable key name", () => {
    const registry = createArtifactRegistry();
    registry.publish(exampleArtifactKey, { value: "first" });

    expect(() =>
      registry.publish(createArtifactKey<ExampleArtifact>("example"), { value: "second" }),
    ).toThrow(DuplicateArtifactError);
  });

  it("reports a missing required artifact by name", () => {
    const registry = createArtifactRegistry();

    expect(() => registry.require(exampleArtifactKey)).toThrow(
      new MissingArtifactError(exampleArtifactKey),
    );
  });

  it("rejects blank artifact key names", () => {
    expect(() => createArtifactKey("  ")).toThrow("Artifact keys must have a non-empty name.");
  });
});
