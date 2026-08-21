import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  collectPackageReport,
  listGeneratorPackages,
  publishHexkitTestReport,
  renderTestReport,
} from "./hexkit-test-report.ts";

function writePackage(
  root: string,
  directory: string,
  options: {
    name: string;
    coverage?: Record<string, { pct: number }>;
  },
): void {
  const absolute = join(root, directory);
  mkdirSync(join(absolute, "coverage"), { recursive: true });
  writeFileSync(join(absolute, "package.json"), JSON.stringify({ name: options.name }));
  if (options.coverage) {
    writeFileSync(
      join(absolute, "coverage", "coverage-summary.json"),
      JSON.stringify({ total: options.coverage }),
    );
  }
}

describe("hexkit-test-report", () => {
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

  it("returns undefined when coverage summary is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-test-report-missing-"));
    mkdirSync(join(root, "packages", "core"), { recursive: true });
    writeFileSync(
      join(root, "packages", "core", "package.json"),
      JSON.stringify({ name: "@hexkit/core" }),
    );
    expect(collectPackageReport("packages/core", root)).toBeUndefined();
  });

  it("renders a per-package coverage table", () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-test-report-"));
    writePackage(root, "packages/core", {
      name: "@hexkit/core",
      coverage: {
        statements: { pct: 96.4 },
        branches: { pct: 89.1 },
        functions: { pct: 100 },
        lines: { pct: 96.2 },
      },
    });

    const row = collectPackageReport("packages/core", root);
    const markdown = renderTestReport([undefined, row]);

    expect(markdown).toContain("## Coverage by package");
    expect(markdown).toContain("`@hexkit/core`");
    expect(markdown).toContain("96.4%");
    expect(markdown).toContain("**89.1%**");
    expect(markdown).not.toContain("| Tests |");
  });

  it("writes the GitHub job summary and throws when no artifacts exist", () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-test-report-publish-"));
    mkdirSync(join(root, "packages"), { recursive: true });
    mkdirSync(join(root, "apps", "cli"), { recursive: true });
    expect(() => publishHexkitTestReport(root)).toThrow(/no coverage/);

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
