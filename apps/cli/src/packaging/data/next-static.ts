export const NEXT_DATABASE_FILE_PATH = "src/adapters/db/database.ts";

export const nextTsconfig = {
  compilerOptions: {
    target: "es2017",
    lib: ["dom", "dom.iterable", "esnext"],
    allowJs: false,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: "esnext",
    moduleResolution: "bundler",
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: "react-jsx",
    incremental: true,
    allowImportingTsExtensions: true,
    plugins: [{ name: "next" }],
    paths: {
      "@/*": ["./src/*"],
    },
  },
  include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  exclude: ["node_modules"],
};

export const nextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`;

export const nextEslintConfig = `import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "error",
    },
  },
  {
    files: ["src/generated/contracts/**/*.ts"],
    rules: {
      // Apical craft emits unused ResponseMap imports and \`let parsedBody\`.
      // Keep Next.js plugin rules; relax only craft-local JS/TS hygiene.
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
`;

export const nextEnv = `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file is generated so type-checking works before Next.js writes next-env.d.ts.
`;

export const nextDockerfile = `FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client \\
  && corepack enable \\
  && corepack prepare pnpm@11.24.0 --activate

COPY package.json pnpm-workspace.yaml ./
RUN pnpm install

COPY . .
RUN chmod +x scripts/start.sh \\
  && ./node_modules/.bin/next build \\
  && pnpm prune --prod

EXPOSE 3000

CMD ["./scripts/start.sh"]
`;

export const nextPnpmWorkspace = "allowBuilds:\n  unrs-resolver: true\n";

export const nextComposeHealthcheck = {
  test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/"] as const,
  startPeriod: "45s",
};
