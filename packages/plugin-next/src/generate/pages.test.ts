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
    responseShape: overrides.responseShape ?? { kind: "json" },
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

function renderResourcePage(overrides: Partial<NextUiPage> = {}) {
  const files = renderPageFiles(
    model({
      uiPages: [
        page({
          filePath: "app/ui/items/page.tsx",
          operationId: "getItem",
          useCaseAccessorName: "getItem",
          ...overrides,
        }),
      ],
    }),
  );
  return files.find((file) => file.path === "app/ui/items/page.tsx")?.contents ?? "";
}

describe("Given renderPageFiles response shapes", () => {
  it("when the shape is entries, then a field/value table is emitted", () => {
    const contents = renderResourcePage({ responseShape: { kind: "entries" } });

    expect(contents).toContain("function renderCell(");
    expect(contents).toContain("<th>Field</th>");
    expect(contents).toContain("<th>Value</th>");
    expect(contents).toContain("Object.entries(result)");
    expect(contents).toContain("result === null || result === undefined");
    expect(contents).not.toContain("<pre>{JSON.stringify(result, null, 2)}</pre>");
  });

  it("when the shape is table, then contract property columns are emitted", () => {
    const contents = renderResourcePage({
      responseShape: { kind: "table", columns: ["id", "name"] },
    });

    expect(contents).toContain("function renderCell(");
    expect(contents).toContain('{["id", "name"].map((column) => (');
    expect(contents).toContain("<th key={column}>{column}</th>");
    expect(contents).toContain(
      "<td key={column}>{renderCell((row as Record<string, unknown>)[column])}</td>",
    );
    expect(contents).not.toContain("<pre>{JSON.stringify(result, null, 2)}</pre>");
  });

  it("when the shape is list, then a list is emitted", () => {
    const contents = renderResourcePage({ responseShape: { kind: "list" } });

    expect(contents).toContain("function renderCell(");
    expect(contents).toContain("<ul>");
    expect(contents).toContain("<li key={index}>{renderCell(item)}</li>");
    expect(contents).not.toContain("<pre>{JSON.stringify(result, null, 2)}</pre>");
  });

  it("when the shape is json, then the JSON dump is emitted without renderCell", () => {
    const contents = renderResourcePage({ responseShape: { kind: "json" } });

    expect(contents).toContain("<pre>{JSON.stringify(result, null, 2)}</pre>");
    expect(contents).not.toContain("function renderCell(");
  });
});
