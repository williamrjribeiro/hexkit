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
      "@hono/node-server": "2.1.1",
      "@standard-schema/spec": "1.1.0",
      "drizzle-orm": "0.45.3",
      hono: "4.13.8",
      pg: "8.23.0",
      zod: "4.6.5",
    },
    devDependencies: {
      "@types/node": "26.6.2",
      "@types/pg": "8.23.1",
      typescript: "7.0.2",
    },
    engines: {
      node: ">=24.18.1",
    },
    packageManager: "pnpm@11.27.1",
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
      "drizzle-orm": "0.45.3",
      next: "16.3.5",
      pg: "8.23.0",
      react: "19.3.0",
      "react-dom": "19.3.0",
      zod: "4.6.5",
    },
    devDependencies: {
      "@types/node": "26.6.2",
      "@types/pg": "8.23.1",
      "@types/react": "19.3.0",
      "@types/react-dom": "19.3.0",
      eslint: "^9",
      "eslint-config-next": "16.3.5",
      typescript: "7.0.2",
    },
    engines: {
      node: ">=24.18.1",
    },
    packageManager: "pnpm@11.27.1",
  };
}
