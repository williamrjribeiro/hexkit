import { describe, expect, it } from "vite-plus/test";

import {
  buildCraftGenerateArgs,
  formatCraftFailure,
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

describe("formatCraftFailure", () => {
  it("when stdout and stderr have details, then they are included after the prefix", () => {
    expect(
      formatCraftFailure({
        status: 2,
        signal: null,
        stdout: "hint",
        stderr: "boom",
      }),
    ).toBe("apical-ts craft failed:\nboom\nhint");
  });

  it("when craft exits without output, then the exit code is reported", () => {
    expect(
      formatCraftFailure({
        status: 1,
        signal: null,
        stdout: "",
        stderr: "  ",
      }),
    ).toBe("apical-ts craft failed with exit code 1");
  });

  it("when craft is terminated by a signal without output, then the signal is reported", () => {
    expect(
      formatCraftFailure({
        status: null,
        signal: "SIGTERM",
        stdout: "",
        stderr: "",
      }),
    ).toBe("apical-ts craft failed with signal SIGTERM");
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
