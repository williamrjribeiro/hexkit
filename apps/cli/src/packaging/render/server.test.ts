import { describe, expect, it } from "vite-plus/test";

import { escapeTemplateLiteral, renderServerSource } from "./server.ts";

describe("Given a Hono server render", () => {
  it("when the title contains template syntax, then the listening prefix is escaped", () => {
    expect(escapeTemplateLiteral("App `v1` uses ${PORT} and \\path")).toBe(
      "App \\`v1\\` uses \\${PORT} and \\\\path",
    );
  });

  it("when repositories are bound, then imports are relative and sorted", () => {
    const source = renderServerSource({
      applicationTitle: "Catalog API",
      createAppFactoryName: "createApp",
      runtimeFilePath: "src/runtime/app.ts",
      repositories: [
        {
          runtimeKey: "items",
          factoryName: "createDrizzleItemRepository",
          filePath: "src/adapters/db/item-repository.ts",
        },
      ],
    });

    expect(source).toContain(
      'import { createDrizzleItemRepository } from "../adapters/db/item-repository.ts";',
    );
    expect(source).toContain('import { createApp } from "./app.ts";');
    expect(source).toContain("items: createDrizzleItemRepository(db)");
    expect(source).toContain("Catalog API listening on http://0.0.0.0:");
  });
});
