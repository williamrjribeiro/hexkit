import type { ContractArtifact } from "@hexkit/plugin-apical";
import type { PersistenceArtifact } from "@hexkit/plugin-drizzle";
import type { HttpArtifact } from "@hexkit/plugin-hono";
import type { NextHttpArtifact } from "@hexkit/plugin-next";

import { nextComposeHealthcheck } from "../data/next-static.ts";
import {
  resolveRuntimeRepositories,
  type RuntimeRepositoryBinding,
} from "./resolve-repositories.ts";

export type ComposePlan = {
  databaseName: string;
  appService: {
    name: "app" | "next";
    healthcheck?: { test: readonly string[]; startPeriod?: string };
  };
};

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

export type HonoPackagingPlan = {
  kind: "hono";
  packageName: string;
  migrationPath: string;
  applicationTitle: string;
  createAppFactoryName: string;
  runtimeFilePath: string;
  repositories: readonly RuntimeRepositoryBinding[];
  compose: ComposePlan;
};

export type NextPackagingPlan = {
  kind: "next";
  packageName: string;
  migrationPath: string;
  repositories: readonly RuntimeRepositoryBinding[];
  compose: ComposePlan;
};

export type PackagingPlan = HonoPackagingPlan | NextPackagingPlan;

function toDatabaseIdentifier(slug: string): string {
  return slug.replaceAll("-", "_");
}

export function buildHonoPackagingPlan(inputs: PackagingInputs): HonoPackagingPlan {
  const { contract, http, persistence } = inputs;
  const databaseName = toDatabaseIdentifier(contract.application.slug);
  const repositories = resolveRuntimeRepositories({
    httpKeys: new Set(http.repositories.map((repository) => repository.parameterName)),
    persistence,
    httpLabel: "HttpArtifact",
  });

  return {
    kind: "hono",
    packageName: `generated-${contract.application.slug}`,
    migrationPath: persistence.migrationPath,
    applicationTitle: contract.application.title,
    createAppFactoryName: http.createAppFactoryName,
    runtimeFilePath: http.runtimeFilePath,
    repositories,
    compose: {
      databaseName,
      appService: { name: "app" },
    },
  };
}

export function buildNextPackagingPlan(inputs: NextPackagingInputs): NextPackagingPlan {
  const { contract, nextHttp, persistence } = inputs;
  const databaseName = toDatabaseIdentifier(contract.application.slug);
  const repositories = resolveRuntimeRepositories({
    httpKeys: new Set(nextHttp.repositories.map((repository) => repository.parameterName)),
    persistence,
    httpLabel: "NextHttpArtifact",
  });

  return {
    kind: "next",
    packageName: `generated-${contract.application.slug}`,
    migrationPath: persistence.migrationPath,
    repositories,
    compose: {
      databaseName,
      appService: {
        name: "next",
        healthcheck: {
          test: nextComposeHealthcheck.test,
          startPeriod: nextComposeHealthcheck.startPeriod,
        },
      },
    },
  };
}
