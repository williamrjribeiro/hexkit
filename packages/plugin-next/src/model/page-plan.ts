import type { NextHttpModel, NextUiPage, NextUiPageParameter } from "../artifact.ts";

export type ResourcePagePlan = {
  kind: "resource";
  filePath: string;
  operationId: string;
  useCaseAccessorName: string;
  needsParams: boolean;
  needsSearchHelper: boolean;
  argumentExpressions: readonly string[];
};

export type RootPagePlan = {
  kind: "root";
  filePath: "app/page.tsx";
  variant: "routes-only" | "hub";
  pages: readonly NextUiPage[];
};

export type UiHubPagePlan = {
  kind: "ui-hub";
  filePath: "app/ui/page.tsx";
  pages: readonly NextUiPage[];
};

export type LayoutPagePlan = {
  kind: "layout";
  filePath: "app/layout.tsx";
};

export type PagePlan = LayoutPagePlan | RootPagePlan | UiHubPagePlan | ResourcePagePlan;

export function coercePageArgument(
  parameter: NextUiPageParameter,
  pathParamNames: readonly string[],
): string {
  const expression = pathParamNames.includes(parameter.name)
    ? `params[${JSON.stringify(parameter.name)}]`
    : `getSearchParam(searchParams, ${JSON.stringify(parameter.name)})`;

  if (parameter.typeExpression === "number") {
    return `Number(${expression} ?? "0")`;
  }
  if (parameter.typeExpression === "boolean") {
    return `(${expression} ?? "false") === "true"`;
  }
  return `${expression} ?? ""`;
}

export function planPageFiles(model: NextHttpModel): readonly PagePlan[] {
  const routePagePaths = new Set(
    model.routes.map((route) => route.filePath.replace(/route\.ts$/, "page.tsx")),
  );
  const resourcePages = model.uiPages.filter((page) => !routePagePaths.has(page.filePath));
  const resourcePagePaths = new Set(resourcePages.map((page) => page.filePath));
  const rootPagePath = "app/page.tsx";
  const uiHubPath = "app/ui/page.tsx";

  const plans: PagePlan[] = [{ kind: "layout", filePath: "app/layout.tsx" }];

  if (!routePagePaths.has(rootPagePath) && !resourcePagePaths.has(rootPagePath)) {
    plans.push({
      kind: "root",
      filePath: "app/page.tsx",
      variant: model.surface === "routes" ? "routes-only" : "hub",
      pages: model.uiPages,
    });
  }

  if (
    model.surface === "both" &&
    resourcePages.length > 0 &&
    !routePagePaths.has(uiHubPath) &&
    !resourcePagePaths.has(uiHubPath)
  ) {
    plans.push({
      kind: "ui-hub",
      filePath: "app/ui/page.tsx",
      pages: resourcePages,
    });
  }

  for (const page of resourcePages) {
    plans.push(planResourcePage(page));
  }

  return plans;
}

export function hasDynamicSegments(page: NextUiPage): boolean {
  return page.paramNames.length > 0 || page.filePath.includes("[");
}

export function pageHref(filePath: string): string {
  const withoutPrefix = filePath.replace(/^app\/?/, "").replace(/\/page\.tsx$/, "");
  return withoutPrefix.length === 0 ? "/" : `/${withoutPrefix}`;
}

function planResourcePage(page: NextUiPage): ResourcePagePlan {
  const needsParams = page.parameters.some((parameter) => page.paramNames.includes(parameter.name));
  const needsSearchHelper = page.parameters.some(
    (parameter) => !page.paramNames.includes(parameter.name),
  );

  return {
    kind: "resource",
    filePath: page.filePath,
    operationId: page.operationId,
    useCaseAccessorName: page.useCaseAccessorName,
    needsParams,
    needsSearchHelper,
    argumentExpressions: page.parameters.map((parameter) =>
      coercePageArgument(parameter, page.paramNames),
    ),
  };
}
