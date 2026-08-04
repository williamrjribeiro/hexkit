import { describe, expect, it } from "vite-plus/test";

import {
  buildCraftGenerateArgs,
  generateContracts,
  type CraftRunner,
  type GenerateContractsOptions,
} from "./generate-contracts.ts";

const petstoreOptions: GenerateContractsOptions = {
  input: "/workspace/apps/petstore-sample/openapi.yaml",
  output: "/workspace/packages/plugin-apical/generated/petstore",
  server: true,
  routes: true,
};

describe("buildCraftGenerateArgs", () => {
  it("builds craft args for Petstore server and routes generation", () => {
    expect(buildCraftGenerateArgs(petstoreOptions)).toEqual([
      "generate",
      "-i",
      petstoreOptions.input,
      "-o",
      petstoreOptions.output,
      "--server",
      "--routes",
    ]);
  });

  it("omits optional generation flags when unset", () => {
    expect(
      buildCraftGenerateArgs({
        input: "openapi.yaml",
        output: "generated",
      }),
    ).toEqual(["generate", "-i", "openapi.yaml", "-o", "generated"]);
  });

  it("includes client when requested", () => {
    expect(
      buildCraftGenerateArgs({
        input: "openapi.yaml",
        output: "generated",
        client: true,
      }),
    ).toEqual(["generate", "-i", "openapi.yaml", "-o", "generated", "--client"]);
  });
});

describe("generateContracts", () => {
  it("awaits the craft runner with Petstore generate args", async () => {
    const calls: string[][] = [];
    const runCraft: CraftRunner = async (args) => {
      await Promise.resolve();
      calls.push([...args]);
    };

    await generateContracts(petstoreOptions, runCraft);

    expect(calls).toEqual([buildCraftGenerateArgs(petstoreOptions)]);
  });
});
