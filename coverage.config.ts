/**
 * Shared Vitest coverage options for Hexkit generator packages
 * (`packages/*` and `apps/cli`). Dogfood apps are out of scope.
 *
 * Thresholds are an intentional quality gate: `vp run coverage` / `vp run ready`
 * fail until every in-scope package meets 90% on all metrics. Raising coverage
 * is follow-up work — do not lower these floors to greenwash the gate.
 */
export const hexkitCoverage = {
  provider: "v8" as const,
  include: ["src/**/*.{ts,tsx}"],
  exclude: ["**/*.{test,spec}.{ts,tsx}", "**/dist/**", "**/node_modules/**"],
  reporter: ["text", "text-summary"] as const,
  thresholds: {
    statements: 90,
    branches: 90,
    functions: 90,
    lines: 90,
  },
};
