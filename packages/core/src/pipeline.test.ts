import { describe, expect, it } from "vite-plus/test";

import type { HexkitPlugin } from "@hexkit/plugin-api";

import { runPipeline } from "./pipeline.ts";

describe("Given generated and protected files that already exist", () => {
  it("when the pipeline runs, then it overwrites generated output and skips and logs protected output", () => {
    const writes: Array<{ path: string; contents: string }> = [];
    const messages: string[] = [];
    const plugin: HexkitPlugin = {
      name: "example",
      generate(context) {
        context.writeFile({
          path: "src/generated/contracts.ts",
          contents: "export const generated = true;\n",
          ownership: "generated",
        });
        context.writeFile({
          path: "src/core/application/get-pet.ts",
          contents: "export const protectedSkeleton = true;\n",
          ownership: "protected",
        });
      },
    };

    runPipeline(
      {
        inputPath: "openapi.yaml",
        outputDirectory: "/tmp/generated-app",
        plugins: [plugin],
      },
      {
        exists: () => true,
        write(path, contents) {
          writes.push({ path, contents });
        },
        log(message) {
          messages.push(message);
        },
      },
    );

    expect(writes).toEqual([
      {
        path: "/tmp/generated-app/src/generated/contracts.ts",
        contents: "export const generated = true;\n",
      },
    ]);
    expect(messages).toEqual(["Skipped existing protected file: src/core/application/get-pet.ts"]);
  });
});

describe("Given plugins in a declared order", () => {
  it("when the pipeline runs, then each plugin executes in that order", () => {
    const pluginOrder: string[] = [];
    const createPlugin = (name: string): HexkitPlugin => ({
      name,
      generate() {
        pluginOrder.push(name);
      },
    });

    runPipeline(
      {
        inputPath: "openapi.yaml",
        outputDirectory: "/tmp/generated-app",
        plugins: [createPlugin("contracts"), createPlugin("architecture"), createPlugin("http")],
      },
      {
        exists: () => false,
        write() {},
        log() {},
      },
    );

    expect(pluginOrder).toEqual(["contracts", "architecture", "http"]);
  });
});

describe("Given an injected logger that uses its action context", () => {
  it("when a plugin logs, then the pipeline preserves the logger receiver", () => {
    const actions = {
      messages: [] as string[],
      exists: () => false,
      write() {},
      log(message: string) {
        this.messages.push(message);
      },
    };

    runPipeline(
      {
        inputPath: "openapi.yaml",
        outputDirectory: "/tmp/generated-app",
        plugins: [
          {
            name: "logging",
            generate(context) {
              context.log("generation started");
            },
          },
        ],
      },
      actions,
    );

    expect(actions.messages).toEqual(["generation started"]);
  });
});
