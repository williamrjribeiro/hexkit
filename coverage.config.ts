/**
 * Shared Vitest coverage options for Hexkit generator packages
 * (`packages/*` and `apps/cli`). Dogfood apps are out of scope.
 *
 * Thresholds are an intentional quality gate: `vp run coverage` / `vp run ready`
 * fail until every in-scope package meets 90% on all metrics. Raising coverage
 * is follow-up work — do not lower these floors to greenwash the gate.
 */
import type { TestUserConfig } from "vite-plus";

export const hexkitCoverage = {
  provider: "v8",
  include: ["src/**/*.{ts,tsx}"],
  exclude: ["**/*.{test,spec}.{ts,tsx}", "**/dist/**", "**/node_modules/**"],
  reporter: ["text", "text-summary"],
  thresholds: {
    statements: 90,
    branches: 90,
    functions: 90,
    lines: 90,
  },
} satisfies NonNullable<TestUserConfig["coverage"]>;
