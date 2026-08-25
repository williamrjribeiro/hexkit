import { describe, expect, it } from "vite-plus/test";

import { renderInMemoryAuthAdapterFile } from "./render-auth-adapter.ts";
import { IN_MEMORY_AUTH_ADAPTER_PATH } from "./security-render.ts";

describe("Given renderInMemoryAuthAdapterFile", () => {
  it("when called with defaults, then it writes the shared adapter path", () => {
    const file = renderInMemoryAuthAdapterFile();

    expect(file.path).toBe(IN_MEMORY_AUTH_ADAPTER_PATH);
    expect(file.ownership).toBe("generated");
    expect(file.contents).toContain("export function createInMemoryAuthenticator");
    expect(file.contents).toContain('credentials.kind === "bearer"');
    expect(file.contents).toContain("options.apiKeys?.get(credentials.headerName.toLowerCase())");
  });

  it("when a custom path is provided, then the authenticator import is rewritten relative to it", () => {
    const file = renderInMemoryAuthAdapterFile("src/other/custom.ts");

    expect(file.path).toBe("src/other/custom.ts");
    expect(file.contents).toContain('from "../core/ports/authenticator.ts"');
  });
});
