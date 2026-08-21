import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { loadValidatedOpenApi } from "./openapi.ts";

describe("loadValidatedOpenApi", () => {
  it("rejects OpenAPI documents that fail validation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hexkit-openapi-invalid-"));
    const inputPath = join(directory, "openapi.yaml");

    try {
      await writeFile(
        inputPath,
        `openapi: "3.1.0"
info:
  title: Broken
paths: {}
`,
        "utf8",
      );

      await expect(loadValidatedOpenApi(inputPath)).rejects.toThrow(/version|Missing|must/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
