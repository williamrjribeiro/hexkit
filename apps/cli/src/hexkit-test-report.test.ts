import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  collectPackageReport,
  listGeneratorPackages,
  parseJunitCounts,
  publishHexkitTestReport,
  renderTestReport,
} from "./hexkit-test-report.ts";

function writePackage(
  root: string,
  directory: string,
  options: {
    name: string;
    coverage?: Record<string, { pct: number }>;
    junit?: string;
  },
): void {
  const absolute = join(root, directory);
  mkdirSync(join(absolute, "coverage"), { recursive: true });
  mkdirSync(join(absolute, "test-results"), { recursive: true });
  writeFileSync(join(absolute, "package.json"), JSON.stringify({ name: options.name }));
  if (options.coverage) {
    writeFileSync(
      join(absolute, "coverage", "coverage-summary.json"),
      JSON.stringify({ total: options.coverage }),
    );
  }
  if (options.junit) {
    writeFileSync(join(absolute, "test-results", "junit.xml"), options.junit);
  }
}

describe("hexkit-test-report", () => {
  it("parses JUnit testsuites counts", () => {
    const xml = `<?xml version="1.0"?>
<testsuites name="@hexkit/cli" tests="43" failures="1" skipped="2">
  <testsuite name="@hexkit/cli" tests="43" failures="1" skipped="2"></testsuite>
</testsuites>
`;
    expect(parseJunitCounts(xml)).toEqual({ tests: 43, failures: 1, skipped: 2 });
  });

  it("parses a single testsuite when testsuites is missing", () => {
    expect(parseJunitCounts(`<testsuite tests="4" failures="0" skipped="1"></testsuite>`)).toEqual({
      tests: 4,
      failures: 0,
      skipped: 1,
    });
  });

  it("returns undefined for XML without test counts", () => {
    expect(parseJunitCounts("<note>not junit</note>")).toBeUndefined();
  });

  it("lists generator package directories", () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-test-report-list-"));
    mkdirSync(join(root, "packages", "core"), { recursive: true });
    mkdirSync(join(root, "packages", "codegen"), { recursive: true });
    mkdirSync(join(root, "apps", "cli"), { recursive: true });
    expect(listGeneratorPackages(root).toSorted()).toEqual([
      "apps/cli",
      "packages/codegen",
      "packages/core",
    ]);
  });

  it("returns undefined when the package manifest is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-test-report-missing-"));
    expect(collectPackageReport("packages/core", root)).toBeUndefined();
  });

  it("renders a per-package table with coverage and test counts", () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-test-report-"));
    writePackage(root, "packages/core", {
      name: "@hexkit/core",
      coverage: {
        statements: { pct: 96.4 },
        branches: { pct: 89.1 },
        functions: { pct: 100 },
        lines: { pct: 96.2 },
      },
      junit: `<testsuites tests="10" failures="0" skipped="0"></testsuites>`,
    });

    const row = collectPackageReport("packages/core", root);
    const markdown = renderTestReport([undefined, row]);

    expect(markdown).toContain("## Hexkit Vitest report");
    expect(markdown).toContain("`@hexkit/core`");
    expect(markdown).toContain("10/10");
    expect(markdown).toContain("96.4%");
    expect(markdown).toContain("**89.1%**");
  });

  it("shows dashes and failed tests when coverage or JUnit is incomplete", () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-test-report-partial-"));
    writePackage(root, "packages/core", {
      name: "@hexkit/core",
      junit: `<testsuites tests="5" failures="2" skipped="0"></testsuites>`,
    });
    const row = collectPackageReport("packages/core", root);
    const markdown = renderTestReport([row]);
    expect(markdown).toContain("**3/5** (2 failed)");
    expect(markdown).toContain("| — |");
  });

  it("writes the GitHub job summary and throws when no artifacts exist", () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-test-report-publish-"));
    mkdirSync(join(root, "packages"), { recursive: true });
    mkdirSync(join(root, "apps", "cli"), { recursive: true });
    expect(() => publishHexkitTestReport(root)).toThrow(/no coverage-summary/);

    writePackage(root, "packages/core", {
      name: "@hexkit/core",
      coverage: {
        statements: { pct: 91 },
        branches: { pct: 91 },
        functions: { pct: 91 },
        lines: { pct: 91 },
      },
    });
    const summary = join(root, "summary.md");
    const previous = process.env.GITHUB_STEP_SUMMARY;
    process.env.GITHUB_STEP_SUMMARY = summary;
    try {
      const markdown = publishHexkitTestReport(root);
      expect(markdown).toContain("`@hexkit/core`");
      expect(readFileSync(summary, "utf8")).toContain("`@hexkit/core`");
    } finally {
      if (previous === undefined) {
        delete process.env.GITHUB_STEP_SUMMARY;
      } else {
        process.env.GITHUB_STEP_SUMMARY = previous;
      }
    }
  });
});
