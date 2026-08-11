import { dirname, relative } from "node:path";

import type { GeneratedFile, GenerationContext, HexkitPlugin } from "@hexkit/plugin-api";
import { APICAL_CONTRACT_ARTIFACT, type ContractArtifact } from "@hexkit/plugin-apical";
import { PERSISTENCE_ARTIFACT, type PersistenceArtifact } from "@hexkit/plugin-drizzle";
import { HTTP_ARTIFACT, type HttpArtifact } from "@hexkit/plugin-hono";
import { NEXT_HTTP_ARTIFACT, type NextHttpArtifact } from "@hexkit/plugin-next";

const SERVER_FILE_PATH = "src/runtime/server.ts";
const NEXT_DATABASE_FILE_PATH = "src/adapters/db/database.ts";

const tsconfig = {
  compilerOptions: {
    target: "esnext",
    lib: ["es2023"],
    moduleDetection: "force",
    module: "nodenext",
    moduleResolution: "nodenext",
    types: ["node"],
    strict: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    isolatedModules: true,
    verbatimModuleSyntax: true,
    skipLibCheck: true,
  },
  include: ["src"],
};

const nextTsconfig = {
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
    jsx: "preserve",
    incremental: true,
    allowImportingTsExtensions: true,
    plugins: [{ name: "next" }],
    baseUrl: ".",
    paths: {
      "@/*": ["./src/*"],
    },
  },
  include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  exclude: ["node_modules"],
};

const startupScript = `#!/bin/sh
set -eu

pnpm run migrate
exec pnpm start
`;

const dockerfile = `FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client \\
  && corepack enable \\
  && corepack prepare pnpm@11.18.0 --activate

COPY package.json ./
RUN pnpm install --prod

COPY . .
RUN chmod +x scripts/start.sh

EXPOSE 3000

CMD ["./scripts/start.sh"]
`;

const dockerignore = `node_modules
dist
.next
.git
`;

const nextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`;

const nextEnv = `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file is generated so type-checking works before Next.js writes next-env.d.ts.
`;

const nextStartupScript = `#!/bin/sh
set -eu

pnpm run migrate
exec pnpm start
`;

const nextDockerfile = `FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client \\
  && corepack enable \\
  && corepack prepare pnpm@11.18.0 --activate

COPY package.json ./
RUN pnpm install

COPY . .
RUN chmod +x scripts/start.sh \\
  && pnpm build \\
  && pnpm prune --prod

EXPOSE 3000

CMD ["./scripts/start.sh"]
`;

export type PackagingInputs = {
  contract: ContractArtifact;
  http: HttpArtifact;
  persistence: PersistenceArtifact;
};

export type NextPackagingInputs = {
  contract: ContractArtifact;
  nextHttp: NextHttpArtifact;
  persistence: PersistenceArtifact;
};

export function generatePackagingFiles(inputs: PackagingInputs): GeneratedFile[] {
  const { contract, http, persistence } = inputs;
  const applicationSlug = contract.application.slug;
  const packageName = `generated-${applicationSlug}`;
  const databaseName = toDatabaseIdentifier(applicationSlug);
  const repositories = resolveRuntimeRepositories(http, persistence);

  return [
    {
      path: "package.json",
      contents: `${JSON.stringify(
        createPackageManifest(packageName, persistence.migrationPath),
        undefined,
        2,
      )}\n`,
      ownership: "generated",
    },
    {
      path: "tsconfig.json",
      contents: `${JSON.stringify(tsconfig, undefined, 2)}\n`,
      ownership: "generated",
    },
    {
      path: SERVER_FILE_PATH,
      contents: renderServerSource({
        applicationTitle: contract.application.title,
        createAppFactoryName: http.createAppFactoryName,
        runtimeFilePath: http.runtimeFilePath,
        repositories,
      }),
      ownership: "generated",
    },
    {
      path: "scripts/start.sh",
      contents: startupScript,
      ownership: "generated",
    },
    {
      path: "Dockerfile",
      contents: dockerfile,
      ownership: "generated",
    },
    {
      path: "docker-compose.yml",
      contents: renderDockerCompose(databaseName),
      ownership: "generated",
    },
    {
      path: ".dockerignore",
      contents: dockerignore,
      ownership: "generated",
    },
  ];
}

export function generateNextPackagingFiles(inputs: NextPackagingInputs): GeneratedFile[] {
  const { contract, nextHttp, persistence } = inputs;
  const applicationSlug = contract.application.slug;
  const packageName = `generated-${applicationSlug}`;
  const databaseName = toDatabaseIdentifier(applicationSlug);
  resolveNextRuntimeRepositories(nextHttp, persistence);

  return [
    {
      path: "package.json",
      contents: `${JSON.stringify(
        createNextPackageManifest(packageName, persistence.migrationPath),
        undefined,
        2,
      )}\n`,
      ownership: "generated",
    },
    {
      path: "next.config.ts",
      contents: nextConfig,
      ownership: "generated",
    },
    {
      path: "next-env.d.ts",
      contents: nextEnv,
      ownership: "generated",
    },
    {
      path: "tsconfig.json",
      contents: `${JSON.stringify(nextTsconfig, undefined, 2)}\n`,
      ownership: "generated",
    },
    {
      path: NEXT_DATABASE_FILE_PATH,
      contents: renderNextDatabaseSource(),
      ownership: "generated",
    },
    {
      path: "scripts/start.sh",
      contents: nextStartupScript,
      ownership: "generated",
    },
    {
      path: "Dockerfile",
      contents: nextDockerfile,
      ownership: "generated",
    },
    {
      path: "docker-compose.yml",
      contents: renderNextDockerCompose(databaseName),
      ownership: "generated",
    },
    {
      path: ".dockerignore",
      contents: dockerignore,
      ownership: "generated",
    },
  ];
}

export function createPackagingPlugin(options: { http?: "hono" | "next" } = {}): HexkitPlugin {
  return {
    name: "packaging",
    generate(context: GenerationContext) {
      const contract = context.artifacts.require(APICAL_CONTRACT_ARTIFACT);
      const persistence = context.artifacts.require(PERSISTENCE_ARTIFACT);
      const files =
        options.http === "next"
          ? generateNextPackagingFiles({
              contract,
              nextHttp: context.artifacts.require(NEXT_HTTP_ARTIFACT),
              persistence,
            })
          : generatePackagingFiles({
              contract,
              http: context.artifacts.require(HTTP_ARTIFACT),
              persistence,
            });

      for (const file of files) {
        context.writeFile(file);
      }
    },
  };
}

type RuntimeRepositoryBinding = {
  runtimeKey: string;
  factoryName: string;
  filePath: string;
};

function resolveRuntimeRepositories(
  http: HttpArtifact,
  persistence: PersistenceArtifact,
): RuntimeRepositoryBinding[] {
  const httpKeys = new Set(http.repositories.map((repository) => repository.parameterName));

  for (const repository of persistence.repositories) {
    if (!httpKeys.has(repository.runtimeKey)) {
      throw new Error(
        `PersistenceArtifact repository runtime key "${repository.runtimeKey}" is missing from HttpArtifact repositories.`,
      );
    }
  }

  const persistenceKeys = new Set(
    persistence.repositories.map((repository) => repository.runtimeKey),
  );
  for (const repository of http.repositories) {
    if (!persistenceKeys.has(repository.parameterName)) {
      throw new Error(
        `HttpArtifact repository parameter "${repository.parameterName}" has no PersistenceArtifact factory binding.`,
      );
    }
  }

  return [...persistence.repositories]
    .map((repository) => ({
      runtimeKey: repository.runtimeKey,
      factoryName: repository.factoryName,
      filePath: repository.filePath,
    }))
    .toSorted((left, right) => compareText(left.runtimeKey, right.runtimeKey));
}

function resolveNextRuntimeRepositories(
  nextHttp: NextHttpArtifact,
  persistence: PersistenceArtifact,
): RuntimeRepositoryBinding[] {
  const nextKeys = new Set(nextHttp.repositories.map((repository) => repository.parameterName));

  for (const repository of persistence.repositories) {
    if (!nextKeys.has(repository.runtimeKey)) {
      throw new Error(
        `PersistenceArtifact repository runtime key "${repository.runtimeKey}" is missing from NextHttpArtifact repositories.`,
      );
    }
  }

  const persistenceKeys = new Set(
    persistence.repositories.map((repository) => repository.runtimeKey),
  );
  for (const repository of nextHttp.repositories) {
    if (!persistenceKeys.has(repository.parameterName)) {
      throw new Error(
        `NextHttpArtifact repository parameter "${repository.parameterName}" has no PersistenceArtifact factory binding.`,
      );
    }
  }

  return [...persistence.repositories]
    .map((repository) => ({
      runtimeKey: repository.runtimeKey,
      factoryName: repository.factoryName,
      filePath: repository.filePath,
    }))
    .toSorted((left, right) => compareText(left.runtimeKey, right.runtimeKey));
}

function createPackageManifest(packageName: string, migrationPath: string) {
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
    packageManager: "pnpm@11.18.0",
  };
}

function createNextPackageManifest(packageName: string, migrationPath: string) {
  return {
    name: packageName,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
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
      typescript: "7.0.2",
    },
    engines: {
      node: ">=24.18.1",
    },
    packageManager: "pnpm@11.18.0",
  };
}

function renderNextDatabaseSource(): string {
  return `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Database = ReturnType<typeof drizzle>;

let pool: Pool | undefined;
let database: Database | undefined;

export function getDatabase(): Database {
  if (database === undefined) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");

    pool = new Pool({ connectionString });
    database = drizzle(pool);
  }

  return database;
}
`;
}

function renderServerSource(options: {
  applicationTitle: string;
  createAppFactoryName: string;
  runtimeFilePath: string;
  repositories: readonly RuntimeRepositoryBinding[];
}): string {
  const localImports = [
    ...options.repositories.map((repository) => ({
      from: relativeImportPath(SERVER_FILE_PATH, repository.filePath),
      name: repository.factoryName,
    })),
    {
      from: relativeImportPath(SERVER_FILE_PATH, options.runtimeFilePath),
      name: options.createAppFactoryName,
    },
  ].toSorted((left, right) => compareText(left.from, right.from));

  const importBlock = localImports
    .map((declaration) => `import { ${declaration.name} } from "${declaration.from}";`)
    .join("\n");

  const appBindings = options.repositories
    .map((repository) => `  ${repository.runtimeKey}: ${repository.factoryName}(db),`)
    .join("\n");

  const listeningPrefix = escapeTemplateLiteral(
    `${options.applicationTitle} listening on http://0.0.0.0:`,
  );

  return `import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

${importBlock}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const port = Number(process.env.PORT ?? "3000");
if (!Number.isInteger(port) || port < 1) throw new Error("PORT must be a positive integer");

const pool = new Pool({ connectionString });
const db = drizzle(pool);
const app = ${options.createAppFactoryName}({
${appBindings}
});

serve({ fetch: app.fetch, port }, ({ port: listeningPort }) => {
  console.log(\`${listeningPrefix}\${listeningPort}\`);
});
`;
}

function renderDockerCompose(databaseName: string): string {
  return `services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-${databaseName}}
      POSTGRES_USER: \${POSTGRES_USER:-${databaseName}}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-${databaseName}}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 2s
      timeout: 5s
      retries: 15
    volumes:
      - postgres-data:/var/lib/postgresql/data

  app:
    build: .
    environment:
      DATABASE_URL: postgres://\${POSTGRES_USER:-${databaseName}}:\${POSTGRES_PASSWORD:-${databaseName}}@postgres:5432/\${POSTGRES_DB:-${databaseName}}
      PORT: "3000"
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3000:3000"

volumes:
  postgres-data:
`;
}

function renderNextDockerCompose(databaseName: string): string {
  return `services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-${databaseName}}
      POSTGRES_USER: \${POSTGRES_USER:-${databaseName}}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-${databaseName}}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 2s
      timeout: 5s
      retries: 15
    volumes:
      - postgres-data:/var/lib/postgresql/data

  next:
    build: .
    environment:
      DATABASE_URL: postgres://\${POSTGRES_USER:-${databaseName}}:\${POSTGRES_PASSWORD:-${databaseName}}@postgres:5432/\${POSTGRES_DB:-${databaseName}}
      HOSTNAME: "0.0.0.0"
      PORT: "3000"
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3000:3000"

volumes:
  postgres-data:
`;
}

function escapeTemplateLiteral(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
}

function toDatabaseIdentifier(slug: string): string {
  return slug.replaceAll("-", "_");
}

function relativeImportPath(fromFilePath: string, toFilePath: string): string {
  const specifier = relative(dirname(fromFilePath), toFilePath).split("\\").join("/");
  return specifier.startsWith(".") ? specifier : `./${specifier}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
