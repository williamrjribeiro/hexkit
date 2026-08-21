/**
 * Shared Vitest coverage options for Hexkit generator packages
 * (`packages/*` and `apps/cli`). Dogfood apps are out of scope.
 *
 * Thresholds are an intentional quality gate: `vp run coverage` / `vp run ready`
 * fail when any in-scope package is below 90% on any metric. Do not lower these
 * floors to greenwash the gate — add tests instead.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TestUserConfig } from "vite-plus";

export const hexkitCoverage = {
  provider: "v8",
  include: ["src/**/*.{ts,tsx}"],
  exclude: [
    "**/*.{test,spec}.{ts,tsx}",
    "**/dist/**",
    "**/node_modules/**",
    "**/hexkit-test-report.ts",
  ],
  reporter: ["text", "text-summary", "json-summary", "json"],
  reportsDirectory: "./coverage",
  reportOnFailure: true,
  thresholds: {
    statements: 90,
    branches: 90,
    functions: 90,
    lines: 90,
  },
} satisfies NonNullable<TestUserConfig["coverage"]>;

export function packageNameFromDirectory(packageDirectory: string): string {
  const manifest = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8")) as {
    name: string;
  };
  return manifest.name;
}

/**
 * Per-package Vitest config: named project (so GitHub/JUnit reports show the
 * package), shared 90% coverage gate, JUnit XML, and GitHub annotations in CI.
 */
export function hexkitTest(packageDirectory: string): TestUserConfig {
  const packageName = packageNameFromDirectory(packageDirectory);
  const github = process.env.GITHUB_ACTIONS === "true";
  const junitReporter: [
    "junit",
    { suiteNameTemplate: string; classnameTemplate: string; outputFile: string },
  ] = [
    "junit",
    {
      suiteNameTemplate: packageName,
      classnameTemplate: `${packageName} · {filename}`,
      outputFile: "./test-results/junit.xml",
    },
  ];

  return {
    name: packageName,
    coverage: hexkitCoverage,
    reporters: github
      ? ["default", ["github-actions", { jobSummary: { enabled: false } }], junitReporter]
      : ["default", junitReporter],
  };
}
