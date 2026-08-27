export function createHonoPackageManifest(packageName: string, migrationPath: string) {
  return {
    name: packageName,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      check: "tsc --noEmit",
      migrate: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ${migrationPath}`,
      start: "node src/runtime/server.ts",
    },
    dependencies: {
      "@hono/node-server": "2.0.12",
      "@standard-schema/spec": "1.1.0",
      "drizzle-orm": "0.45.2",
      hono: "4.13.0",
      pg: "8.22.0",
      zod: "4.4.3",
    },
    devDependencies: {
      "@types/node": "26.1.2",
      "@types/pg": "8.20.3",
      typescript: "7.0.2",
    },
    engines: {
      node: ">=24.18.1",
    },
    packageManager: "pnpm@11.24.0",
  };
}

export function createNextPackageManifest(packageName: string, migrationPath: string) {
  return {
    name: packageName,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "eslint . --max-warnings 0",
      check: "next build",
      migrate: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ${migrationPath}`,
    },
    dependencies: {
      "@standard-schema/spec": "1.1.0",
      "drizzle-orm": "0.45.2",
      next: "16.3.0",
      pg: "8.22.0",
      react: "19.2.8",
      "react-dom": "19.2.8",
      zod: "4.4.3",
    },
    devDependencies: {
      "@types/node": "26.1.2",
      "@types/pg": "8.20.3",
      "@types/react": "19.2.18",
      "@types/react-dom": "19.2.4",
      eslint: "^9",
      "eslint-config-next": "16.3.0",
      typescript: "7.0.2",
    },
    engines: {
      node: ">=24.18.1",
    },
    packageManager: "pnpm@11.24.0",
  };
}
