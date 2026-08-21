import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      "RFC.md",
      // Dogfood fixtures are validated by their own generate loops, not `vp check`.
      "apps/petstore-sample/**",
      "apps/petstore-next/**",
      "apps/fixtures/**",
    ],
  },
  lint: {
    // Oxlint covers Hexkit (`packages/*` + `apps/cli`) only. Dogfood apps use
    // their generated-app tooling (Oxlint/`tsc` for Hono, ESLint 9 + TS 5 for Next).
    ignorePatterns: ["apps/petstore-sample/**", "apps/petstore-next/**", "apps/fixtures/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
    tasks: {
      dogfood: {
        command: "apps/petstore-sample/scripts/dogfood.sh",
        // Vite+ 0.2.7 uncached tasks inherit caller env. Its schema rejects
        // `env` together with `cache: false`; the controlled task proof covers
        // PETSTORE_API_URL, HEXKIT_KEEP_STACK, and HEXKIT_DOGFOOD_OUTPUT.
        cache: false,
      },
      "dogfood-auth": {
        command: "apps/fixtures/auth-api/scripts/dogfood.sh",
        // Same uncached env inheritance as dogfood; covers AUTH_API_URL,
        // HEXKIT_KEEP_STACK, and HEXKIT_DOGFOOD_OUTPUT.
        cache: false,
      },
      "dogfood-petstore-next": {
        command: "apps/petstore-next/scripts/dogfood.sh",
        // Same uncached env inheritance as dogfood; covers PETSTORE_NEXT_URL,
        // HEXKIT_SKIP_COMPOSE, HEXKIT_KEEP_STACK, and HEXKIT_DOGFOOD_OUTPUT.
        cache: false,
      },
    },
  },
});
