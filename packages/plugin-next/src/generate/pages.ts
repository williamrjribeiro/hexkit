import type { GeneratedFile } from "@hexkit/plugin-api";

import type { NextHttpModel, NextUiPage } from "../artifact.ts";
import {
  hasDynamicSegments,
  pageHref,
  planPageFiles,
  type PagePlan,
  type ResourcePagePlan,
} from "../model/page-plan.ts";

export function renderPageFiles(model: NextHttpModel): GeneratedFile[] {
  return planPageFiles(model).map(renderPlannedPage);
}

function renderPlannedPage(plan: PagePlan): GeneratedFile {
  switch (plan.kind) {
    case "layout":
      return renderLayoutFile();
    case "root":
      return {
        path: plan.filePath,
        contents:
          plan.variant === "routes-only"
            ? renderRoutesOnlyPageSource()
            : renderHubPageSource(plan.pages),
        ownership: "generated",
      };
    case "ui-hub":
      return {
        path: plan.filePath,
        contents: renderHubPageSource(plan.pages),
        ownership: "generated",
      };
    case "resource":
      return renderResourcePageFile(plan);
  }
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

function renderHubPageSource(pages: readonly NextUiPage[]): string {
  const hasStaticPages = pages.some((page) => !hasDynamicSegments(page));
  const pageEntries = pages.map(renderHubPageEntry).join("\n");

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

function renderResourcePageFile(plan: ResourcePagePlan): GeneratedFile {
  const argumentsList = plan.argumentExpressions.join(", ");
  const pagePropsType = [
    ...(plan.needsParams ? ["  params: Promise<Record<string, string>>;"] : []),
    ...(plan.needsSearchHelper
      ? ["  searchParams: Promise<Record<string, string | string[] | undefined>>;"]
      : []),
  ];

  return {
    path: plan.filePath,
    contents: [
      'import { getServerAccess } from "@/adapters/http-next/server-access";',
      "",
      ...(plan.needsSearchHelper ? [renderSearchParamHelper(), ""] : []),
      'export const dynamic = "force-dynamic";',
      "",
      ...(pagePropsType.length > 0
        ? [
            "export default async function Page(props: {",
            ...pagePropsType,
            "}) {",
            ...(plan.needsParams ? ["  const params = await props.params;"] : []),
            ...(plan.needsSearchHelper ? ["  const searchParams = await props.searchParams;"] : []),
          ]
        : ["export default async function Page() {"]),
      "  const access = getServerAccess();",
      `  const result = await access.${plan.useCaseAccessorName}(${argumentsList});`,
      "",
      "  return (",
      "    <main>",
      `      <h1>{${JSON.stringify(plan.operationId)}}</h1>`,
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
