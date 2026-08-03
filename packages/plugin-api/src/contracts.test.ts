import { describe, expect, expectTypeOf, it } from "vite-plus/test";

import * as contracts from "./contracts.ts";
import type { GeneratedFile, GenerationContext, HexkitPlugin } from "./contracts.ts";

describe("Given the framework-agnostic plugin contracts", () => {
  it("when a plugin generates output, then the context receives the declared file", () => {
    const files: GeneratedFile[] = [];
    const messages: string[] = [];
    const plugin: HexkitPlugin = {
      name: "example",
      generate(context) {
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
      writeFile(file) {
        files.push(file);
      },
      log(message) {
        messages.push(message);
      },
    };

    plugin.generate(context);

    expect(files).toEqual([
      {
        path: "src/example.ts",
        contents: "export const example = true;\n",
        ownership: "generated",
      },
    ]);
    expect(messages).toEqual(["example generated"]);
    expect(Object.keys(contracts)).toEqual([]);
    expectTypeOf<GeneratedFile["ownership"]>().toEqualTypeOf<"generated" | "protected">();
  });
});
