import { describe, expect, it } from "vite-plus/test";

import type { NextHttpModel, NextUiPage } from "../artifact.ts";
import { renderPageFiles } from "./pages.ts";

function page(
  overrides: Partial<NextUiPage> & Pick<NextUiPage, "filePath" | "operationId">,
): NextUiPage {
  return {
    openApiPath: overrides.openApiPath ?? "/items/search",
    useCaseAccessorName: overrides.useCaseAccessorName ?? overrides.operationId,
    paramNames: overrides.paramNames ?? [],
    parameters: overrides.parameters ?? [],
    ...overrides,
  };
}

function model(overrides: Partial<NextHttpModel> = {}): NextHttpModel {
  return {
    surface: "both",
    routes: [],
    uiPages: [],
    repositories: [],
    ...overrides,
  };
}

describe("Given renderPageFiles search helpers", () => {
  it("when a page has scalar and array query params, then both helpers are emitted", () => {
    const files = renderPageFiles(
      model({
        uiPages: [
          page({
            filePath: "app/ui/items/search/page.tsx",
            operationId: "searchItems",
            parameters: [
              { name: "q", typeExpression: "string" },
              { name: "tags", typeExpression: "Array<string>" },
            ],
          }),
        ],
      }),
    );
    const generated = files.find((file) => file.path === "app/ui/items/search/page.tsx");

    expect(generated?.contents).toContain("function getSearchParam(");
    expect(generated?.contents).toContain("function getSearchParamValues(");
    expect(generated?.contents).toContain('getSearchParam(searchParams, "q") ?? ""');
    expect(generated?.contents).toContain(
      'getSearchParamValues(searchParams, "tags") as Array<string>',
    );
  });
});
