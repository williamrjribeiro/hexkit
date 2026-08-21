/**
 * Append per-package coverage metrics to the GitHub Actions job summary.
 * Test results come from Vitest's built-in github-actions reporter; this
 * table is only the 90% coverage gate (that reporter does not print coverage).
 */
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const THRESHOLD = 90;

export type CoverageMetric = {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
};

export type PackageReport = {
  name: string;
  directory: string;
  totals: Record<string, CoverageMetric>;
};

export function listGeneratorPackages(root = ROOT): string[] {
  const packages = readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join("packages", entry.name));
  return [...packages, join("apps", "cli")];
}

export function collectPackageReport(
  packageDirectory: string,
  root = ROOT,
): PackageReport | undefined {
  const absolute = join(root, packageDirectory);
  const manifestPath = join(absolute, "package.json");
  const summaryPath = join(absolute, "coverage", "coverage-summary.json");
  if (!existsSync(manifestPath) || !existsSync(summaryPath)) {
    return undefined;
  }
  const name = (JSON.parse(readFileSync(manifestPath, "utf8")) as { name: string }).name;
  const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as {
    total: Record<string, CoverageMetric>;
  };
  return { name, directory: packageDirectory, totals: summary.total };
}

function formatPct(pct: number | undefined): string {
  if (pct === undefined || Number.isNaN(pct)) {
    return "—";
  }
  const text = `${pct.toFixed(1)}%`;
  return pct + 1e-9 < THRESHOLD ? `**${text}**` : text;
}

export function renderTestReport(rows: Array<PackageReport | undefined>): string {
  const lines = [
    "## Coverage by package",
    "",
    "Vitest's [GitHub Actions reporter](https://vitest.dev/guide/reporters.html#github-actions-reporter) prints per-package test results above. This table is the **90%** coverage gate (statements, branches, functions, lines).",
    "",
    "| Package | Statements | Branches | Functions | Lines |",
    "| --- | ---: | ---: | ---: | ---: |",
  ];

  for (const row of rows) {
    if (row === undefined) {
      continue;
    }
    lines.push(
      `| \`${row.name}\` | ${formatPct(row.totals.statements?.pct)} | ${formatPct(row.totals.branches?.pct)} | ${formatPct(row.totals.functions?.pct)} | ${formatPct(row.totals.lines?.pct)} |`,
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function publishHexkitTestReport(root = ROOT): string {
  const rows = listGeneratorPackages(root)
    .map((directory) => collectPackageReport(directory, root))
    .filter((row) => row !== undefined);

  if (rows.length === 0) {
    throw new Error(
      "hexkit-test-report: no coverage/coverage-summary.json found under packages/* or apps/cli",
    );
  }

  const markdown = renderTestReport(rows);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, markdown);
  }
  return markdown;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isMainModule()) {
  try {
    process.stdout.write(publishHexkitTestReport());
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
