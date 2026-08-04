import { describe, expect, it } from "vite-plus/test";

import { createArtifactKey, type GenerationContext, type HexkitPlugin } from "@hexkit/plugin-api";

import { runPipeline } from "./pipeline.ts";

describe("Given generated and protected files that already exist", () => {
  it("when the pipeline runs, then it overwrites generated output and skips and logs protected output", async () => {
    const writes: Array<{ path: string; contents: string }> = [];
    const messages: string[] = [];
    const plugin: HexkitPlugin = {
      name: "example",
      generate(context: GenerationContext) {
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

    await runPipeline(
      {
        inputPath: "openapi.yaml",
        outputDirectory: "/tmp/generated-app",
        plugins: [plugin],
      },
      {
        exists: () => true,
        write(path: string, contents: string) {
          writes.push({ path, contents });
        },
        log(message: string) {
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
  it("when the pipeline runs, then each async plugin completes before the next starts", async () => {
    const pluginOrder: string[] = [];
    const createPlugin = (name: string): HexkitPlugin => ({
      name,
      async generate() {
        pluginOrder.push(`${name}:start`);
        await Promise.resolve();
        pluginOrder.push(`${name}:end`);
      },
    });

    await runPipeline(
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

    expect(pluginOrder).toEqual([
      "contracts:start",
      "contracts:end",
      "architecture:start",
      "architecture:end",
      "http:start",
      "http:end",
    ]);
  });
});

describe("Given an injected logger that uses its action context", () => {
  it("when a plugin logs, then the pipeline preserves the logger receiver", async () => {
    const actions = {
      messages: [] as string[],
      exists: () => false,
      write() {},
      log(message: string) {
        this.messages.push(message);
      },
    };

    await runPipeline(
      {
        inputPath: "openapi.yaml",
        outputDirectory: "/tmp/generated-app",
        plugins: [
          {
            name: "logging",
            generate(context: GenerationContext) {
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

describe("Given plugins that exchange typed artifacts", () => {
  it("uses one registry for the complete pipeline run", async () => {
    const contractKey = createArtifactKey<{ title: string }>("contract");
    let consumedTitle: string | undefined;

    await runPipeline(
      {
        inputPath: "openapi.yaml",
        outputDirectory: "/tmp/generated-app",
        plugins: [
          {
            name: "producer",
            generate(context) {
              context.artifacts.publish(contractKey, { title: "Library" });
            },
          },
          {
            name: "consumer",
            generate(context) {
              consumedTitle = context.artifacts.require(contractKey).title;
            },
          },
        ],
      },
      {
        exists: () => false,
        write() {},
        log() {},
      },
    );

    expect(consumedTitle).toBe("Library");
  });

  it("creates an isolated registry for each pipeline run", async () => {
    const contractKey = createArtifactKey<{ title: string }>("isolated-contract");
    const actions = {
      exists: () => false,
      write() {},
      log() {},
    };

    await runPipeline(
      {
        inputPath: "first.yaml",
        outputDirectory: "/tmp/first",
        plugins: [
          {
            name: "producer",
            generate(context) {
              context.artifacts.publish(contractKey, { title: "First" });
            },
          },
        ],
      },
      actions,
    );

    await expect(
      runPipeline(
        {
          inputPath: "second.yaml",
          outputDirectory: "/tmp/second",
          plugins: [
            {
              name: "consumer",
              generate(context) {
                context.artifacts.require(contractKey);
              },
            },
          ],
        },
        actions,
      ),
    ).rejects.toThrow('Required artifact "isolated-contract" has not been published.');
  });

  it("surfaces missing artifacts and does not continue", async () => {
    const missingKey = createArtifactKey<{ title: string }>("missing-contract");
    const invoked: string[] = [];

    await expect(
      runPipeline(
        {
          inputPath: "openapi.yaml",
          outputDirectory: "/tmp/generated-app",
          plugins: [
            {
              name: "consumer",
              generate(context) {
                invoked.push("consumer");
                context.artifacts.require(missingKey);
              },
            },
            {
              name: "must-not-run",
              generate() {
                invoked.push("must-not-run");
              },
            },
          ],
        },
        {
          exists: () => false,
          write() {},
          log() {},
        },
      ),
    ).rejects.toThrow('Required artifact "missing-contract" has not been published.');
    expect(invoked).toEqual(["consumer"]);
  });

  it("propagates plugin failures and does not invoke later plugins", async () => {
    const invoked: string[] = [];

    await expect(
      runPipeline(
        {
          inputPath: "openapi.yaml",
          outputDirectory: "/tmp/generated-app",
          plugins: [
            {
              name: "failing",
              async generate() {
                invoked.push("failing");
                await Promise.resolve();
                throw new Error("generation failed");
              },
            },
            {
              name: "must-not-run",
              generate() {
                invoked.push("must-not-run");
              },
            },
          ],
        },
        {
          exists: () => false,
          write() {},
          log() {},
        },
      ),
    ).rejects.toThrow("generation failed");
    expect(invoked).toEqual(["failing"]);
  });
});
