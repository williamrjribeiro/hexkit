/**
 * Build a per-package Vitest + coverage table for CI job summaries.
 * Reads each generator package's coverage-summary.json (and optional JUnit).
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

export type JunitCounts = {
  tests: number;
  failures: number;
  skipped: number;
};

export type PackageReport = {
  name: string;
  directory: string;
  totals: Record<string, CoverageMetric> | undefined;
  junit: JunitCounts | undefined;
};

export function listGeneratorPackages(root = ROOT): string[] {
  const packages = readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join("packages", entry.name));
  return [...packages, join("apps", "cli")];
}

export function parseJunitCounts(xml: string): JunitCounts | undefined {
  const suites = /<testsuites\b([^>]*)>/i.exec(xml);
  const suite = /<testsuite\b([^>]*)>/i.exec(xml);
  const attrs = suites?.[1] ?? suite?.[1];
  if (attrs === undefined) {
    return undefined;
  }
  const tests = Number(/tests="(\d+)"/.exec(attrs)?.[1] ?? Number.NaN);
  const failures = Number(/failures="(\d+)"/.exec(attrs)?.[1] ?? 0);
  const skipped = Number(/skipped="(\d+)"/.exec(attrs)?.[1] ?? 0);
  if (Number.isNaN(tests)) {
    return undefined;
  }
  return { tests, failures, skipped };
}

export function collectPackageReport(
  packageDirectory: string,
  root = ROOT,
): PackageReport | undefined {
  const absolute = join(root, packageDirectory);
  const manifestPath = join(absolute, "package.json");
  if (!existsSync(manifestPath)) {
    return undefined;
  }
  const name = (JSON.parse(readFileSync(manifestPath, "utf8")) as { name: string }).name;
  const summaryPath = join(absolute, "coverage", "coverage-summary.json");
  const junitPath = join(absolute, "test-results", "junit.xml");
  let totals: Record<string, CoverageMetric> | undefined;
  if (existsSync(summaryPath)) {
    const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as {
      total: Record<string, CoverageMetric>;
    };
    totals = summary.total;
  }
  const junit = existsSync(junitPath)
    ? parseJunitCounts(readFileSync(junitPath, "utf8"))
    : undefined;
  return { name, directory: packageDirectory, totals, junit };
}

function formatPct(pct: number | undefined): string {
  if (pct === undefined || Number.isNaN(pct)) {
    return "—";
  }
  const text = `${pct.toFixed(1)}%`;
  return pct + 1e-9 < THRESHOLD ? `**${text}**` : text;
}

function formatTests(junit: JunitCounts | undefined): string {
  if (junit === undefined) {
    return "—";
  }
  const passed = junit.tests - junit.failures - junit.skipped;
  if (junit.failures > 0) {
    return `**${passed}/${junit.tests}** (${junit.failures} failed)`;
  }
  return `${passed}/${junit.tests}`;
}

export function renderTestReport(rows: Array<PackageReport | undefined>): string {
  const lines = [
    "## Hexkit Vitest report",
    "",
    "Generator packages (`packages/*` + `apps/cli`). Coverage gate is **90%** on statements, branches, functions, and lines.",
    "",
    "| Package | Tests | Statements | Branches | Functions | Lines |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of rows) {
    if (row === undefined) {
      continue;
    }
    const stmts = formatPct(row.totals?.statements?.pct);
    const branches = formatPct(row.totals?.branches?.pct);
    const funcs = formatPct(row.totals?.functions?.pct);
    const linesPct = formatPct(row.totals?.lines?.pct);
    lines.push(
      `| \`${row.name}\` | ${formatTests(row.junit)} | ${stmts} | ${branches} | ${funcs} | ${linesPct} |`,
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function publishHexkitTestReport(root = ROOT): string {
  const rows = listGeneratorPackages(root)
    .map((directory) => collectPackageReport(directory, root))
    .filter((row) => row !== undefined && (row.totals !== undefined || row.junit !== undefined));

  if (rows.length === 0) {
    throw new Error(
      "hexkit-test-report: no coverage-summary.json or junit.xml found under packages/* or apps/cli",
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
