import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import { generateContracts } from "./generate-contracts.ts";

function mockChild(options: {
  status?: number | null;
  signal?: NodeJS.Signals | null;
  stdout?: string;
  stderr?: string;
  emitError?: Error;
}): EventEmitter {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  spawnMock.mockReturnValue(child);

  queueMicrotask(() => {
    if (options.emitError) {
      child.emit("error", options.emitError);
      return;
    }
    if (options.stdout) child.stdout.emit("data", Buffer.from(options.stdout));
    if (options.stderr) child.stderr.emit("data", Buffer.from(options.stderr));
    child.emit("close", options.status ?? 1, options.signal ?? null);
  });

  return child;
}

describe("generateContracts default craft runner", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("rejects when the craft process fails to start", async () => {
    mockChild({ emitError: new Error("spawn EACCES") });

    await expect(
      generateContracts({ input: "openapi.yaml", output: "out", server: true }),
    ).rejects.toThrow("Unable to start apical-ts craft: spawn EACCES");
  });

  it("rejects with formatted craft output on non-zero exit", async () => {
    mockChild({ status: 2, stderr: "boom", stdout: "hint" });

    await expect(generateContracts({ input: "openapi.yaml", output: "out" })).rejects.toThrow(
      "apical-ts craft failed:\nboom\nhint",
    );
  });

  it("resolves when craft exits successfully and forwards generate args", async () => {
    mockChild({ status: 0, stdout: "ok" });

    await expect(
      generateContracts({ input: "openapi.yaml", output: "out", routes: true }),
    ).resolves.toBeUndefined();

    expect(spawnMock).toHaveBeenCalledOnce();
    const args = spawnMock.mock.calls[0]?.[1] as string[];
    expect(args.slice(1)).toEqual(["generate", "-i", "openapi.yaml", "-o", "out", "--routes"]);
  });
});
