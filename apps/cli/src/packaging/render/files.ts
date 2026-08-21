import type { GeneratedFile } from "@hexkit/plugin-api";

import {
  dockerignore,
  honoDockerfile,
  honoTsconfig,
  SERVER_FILE_PATH,
} from "../data/hono-static.ts";
import {
  NEXT_DATABASE_FILE_PATH,
  nextConfig,
  nextDockerfile,
  nextEnv,
  nextEslintConfig,
  nextPnpmWorkspace,
  nextTsconfig,
} from "../data/next-static.ts";
import { createHonoPackageManifest, createNextPackageManifest } from "../model/manifests.ts";
import {
  buildHonoPackagingPlan,
  buildNextPackagingPlan,
  type HonoPackagingPlan,
  type NextPackagingInputs,
  type NextPackagingPlan,
  type PackagingInputs,
  type PackagingPlan,
} from "../model/plan.ts";
import { renderDockerCompose } from "./compose.ts";
import { renderNextDatabaseSource, renderNextStartupScript } from "./database.ts";
import { renderServerSource, renderStartupScript } from "./server.ts";

export function generatePackagingFiles(inputs: PackagingInputs): GeneratedFile[] {
  return renderPackagingFiles(buildHonoPackagingPlan(inputs));
}

export function generateNextPackagingFiles(inputs: NextPackagingInputs): GeneratedFile[] {
  return renderPackagingFiles(buildNextPackagingPlan(inputs));
}

export function renderPackagingFiles(plan: PackagingPlan): GeneratedFile[] {
  return plan.kind === "next" ? renderNextFiles(plan) : renderHonoFiles(plan);
}

function renderHonoFiles(plan: HonoPackagingPlan): GeneratedFile[] {
  return [
    jsonFile("package.json", createHonoPackageManifest(plan.packageName, plan.migrationPath)),
    jsonFile("tsconfig.json", honoTsconfig),
    sourceFile(
      SERVER_FILE_PATH,
      renderServerSource({
        applicationTitle: plan.applicationTitle,
        createAppFactoryName: plan.createAppFactoryName,
        runtimeFilePath: plan.runtimeFilePath,
        repositories: plan.repositories,
      }),
    ),
    sourceFile("scripts/start.sh", renderStartupScript(plan.migrationPath)),
    sourceFile("Dockerfile", honoDockerfile),
    sourceFile("docker-compose.yml", renderDockerCompose(plan.compose)),
    sourceFile(".dockerignore", dockerignore),
  ];
}

function renderNextFiles(plan: NextPackagingPlan): GeneratedFile[] {
  return [
    jsonFile("package.json", createNextPackageManifest(plan.packageName, plan.migrationPath)),
    sourceFile("next.config.ts", nextConfig),
    sourceFile("eslint.config.mjs", nextEslintConfig),
    sourceFile("next-env.d.ts", nextEnv),
    jsonFile("tsconfig.json", nextTsconfig),
    sourceFile(NEXT_DATABASE_FILE_PATH, renderNextDatabaseSource()),
    sourceFile("pnpm-workspace.yaml", nextPnpmWorkspace),
    sourceFile("scripts/start.sh", renderNextStartupScript(plan.migrationPath)),
    sourceFile("Dockerfile", nextDockerfile),
    sourceFile("docker-compose.yml", renderDockerCompose(plan.compose)),
    sourceFile(".dockerignore", dockerignore),
  ];
}

function jsonFile(path: string, value: unknown): GeneratedFile {
  return {
    path,
    contents: `${JSON.stringify(value, undefined, 2)}\n`,
    ownership: "generated",
  };
}

function sourceFile(path: string, contents: string): GeneratedFile {
  return { path, contents, ownership: "generated" };
}
