import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { NextHttpModel, NextUiPage } from "../artifact.ts";

export function renderPageFiles(
  model: NextHttpModel,
  application: ApplicationArtifact,
): GeneratedFile[] {
  const routePagePaths = new Set(
    model.routes.map((route) => route.filePath.replace(/route\.ts$/, "page.tsx")),
  );
  const resourcePages = model.uiPages.filter((page) => !routePagePaths.has(page.filePath));
  const resourcePagePaths = new Set(resourcePages.map((page) => page.filePath));
  const rootPagePath = "app/page.tsx";
  const uiHubPath = "app/ui/page.tsx";

  return [
    renderLayoutFile(),
    ...(routePagePaths.has(rootPagePath) || resourcePagePaths.has(rootPagePath)
      ? []
      : [renderRootPageFile(model)]),
    ...(model.surface === "both" &&
    resourcePages.length > 0 &&
    !routePagePaths.has(uiHubPath) &&
    !resourcePagePaths.has(uiHubPath)
      ? [renderUiHubFile({ ...model, uiPages: resourcePages })]
      : []),
    ...resourcePages.map((page) => renderResourcePageFile(page, application)),
  ];
}

function renderLayoutFile(): GeneratedFile {
  return {
    path: "app/layout.tsx",
    contents: [
      'import type { Metadata } from "next";',
      'import type { ReactNode } from "react";',
      "",
      "export const metadata: Metadata = {",
      '  title: "Hexkit generated app",',
      "};",
      "",
      "export default function RootLayout(props: { children: ReactNode }) {",
      "  return (",
      '    <html lang="en">',
      "      <body>{props.children}</body>",
      "    </html>",
      "  );",
      "}",
      "",
    ].join("\n"),
    ownership: "generated",
  };
}

function renderRootPageFile(model: NextHttpModel): GeneratedFile {
  return {
    path: "app/page.tsx",
    contents:
      model.surface === "routes" ? renderRoutesOnlyPageSource() : renderHubPageSource(model),
    ownership: "generated",
  };
}

function renderUiHubFile(model: NextHttpModel): GeneratedFile {
  return {
    path: "app/ui/page.tsx",
    contents: renderHubPageSource(model),
    ownership: "generated",
  };
}

function renderRoutesOnlyPageSource(): string {
  return [
    "export default function Page() {",
    "  return (",
    "    <main>",
    "      <h1>Hexkit generated API only</h1>",
    "      <p>API only: this generated app exposes Route Handlers for the OpenAPI contract.</p>",
    "    </main>",
    "  );",
    "}",
    "",
  ].join("\n");
}

function renderHubPageSource(model: NextHttpModel): string {
  const hasStaticPages = model.uiPages.some((page) => !hasDynamicSegments(page));
  const pageEntries = model.uiPages.map(renderHubPageEntry).join("\n");

  return [
    ...(hasStaticPages ? ['import Link from "next/link";', ""] : []),
    "export default function Page() {",
    "  return (",
    "    <main>",
    "      <h1>Hexkit generated UI</h1>",
    "      <ul>",
    pageEntries,
    "      </ul>",
    "    </main>",
    "  );",
    "}",
    "",
  ].join("\n");
}

function renderHubPageEntry(page: NextUiPage): string {
  const href = pageHref(page.filePath);
  if (hasDynamicSegments(page)) {
    return [
      "        <li>",
      `          ${page.operationId} <code>${href}</code>`,
      "        </li>",
    ].join("\n");
  }

  return [
    "        <li>",
    `          <Link href=${JSON.stringify(href)}>${page.operationId}</Link>`,
    "        </li>",
  ].join("\n");
}

function renderResourcePageFile(page: NextUiPage, application: ApplicationArtifact): GeneratedFile {
  const useCase = application.useCases.find(
    (candidate) => candidate.operationId === page.operationId,
  );
  if (useCase === undefined) {
    throw new Error(`ApplicationArtifact is missing use case for operation "${page.operationId}".`);
  }

  const argumentsList = useCase.parameters
    .map((parameter) => renderUseCaseArgument(parameter, page))
    .join(", ");
  const needsParams = useCase.parameters.some((parameter) =>
    page.paramNames.includes(parameter.name),
  );
  const needsSearchHelper = useCase.parameters.some(
    (parameter) => !page.paramNames.includes(parameter.name),
  );
  const pagePropsType = [
    ...(needsParams ? ["  params: Promise<Record<string, string>>;"] : []),
    ...(needsSearchHelper
      ? ["  searchParams: Promise<Record<string, string | string[] | undefined>>;"]
      : []),
  ];

  return {
    path: page.filePath,
    contents: [
      'import { getServerAccess } from "@/adapters/http-next/server-access";',
      "",
      ...(needsSearchHelper ? [renderSearchParamHelper(), ""] : []),
      'export const dynamic = "force-dynamic";',
      "",
      ...(pagePropsType.length > 0
        ? [
            "export default async function Page(props: {",
            ...pagePropsType,
            "}) {",
            ...(needsParams ? ["  const params = await props.params;"] : []),
            ...(needsSearchHelper ? ["  const searchParams = await props.searchParams;"] : []),
          ]
        : ["export default async function Page() {"]),
      "  const access = getServerAccess();",
      `  const result = await access.${page.useCaseAccessorName}(${argumentsList});`,
      "",
      "  return (",
      "    <main>",
      `      <h1>{${JSON.stringify(page.operationId)}}</h1>`,
      "      <pre>{JSON.stringify(result, null, 2)}</pre>",
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
    ownership: "generated",
  };
}

function renderSearchParamHelper(): string {
  return [
    "function getSearchParam(",
    "  searchParams: Record<string, string | string[] | undefined>,",
    "  name: string,",
    "): string | undefined {",
    "  const value = searchParams[name];",
    "  return Array.isArray(value) ? value[0] : value;",
    "}",
  ].join("\n");
}

function renderUseCaseArgument(
  parameter: ApplicationArtifact["useCases"][number]["parameters"][number],
  page: NextUiPage,
): string {
  const expression = page.paramNames.includes(parameter.name)
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

function hasDynamicSegments(page: NextUiPage): boolean {
  return page.paramNames.length > 0 || page.filePath.includes("[");
}

function pageHref(filePath: string): string {
  const withoutPrefix = filePath.replace(/^app\/?/, "").replace(/\/page\.tsx$/, "");
  return withoutPrefix.length === 0 ? "/" : `/${withoutPrefix}`;
}
