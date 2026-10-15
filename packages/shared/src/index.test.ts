import { describe, expect, it } from "vite-plus/test";

import { IN_MEMORY_AUTH_ADAPTER_PATH } from "./index.ts";

describe("Given the @hexkit/shared public API", () => {
  it("when imported from the package barrel, then adapter paths are stable", () => {
    expect(IN_MEMORY_AUTH_ADAPTER_PATH).toBe("src/adapters/auth/in-memory-authenticator.ts");
  });
});
