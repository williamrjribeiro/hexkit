import { uniformInt } from "pure-rand/distribution/uniformInt";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";

import type { GeneratedApicalModules } from "./contract/generated-index.ts";
import { normalizeContractArtifact } from "./contract/normalize.ts";
import type { ContractArtifact } from "./contract/types.ts";

export const LIBRARY_SHAPED_NOUNS = [
  "Axle",
  "Bed",
  "Bolt",
  "Brick",
  "Chair",
  "Clamp",
  "Coin",
  "Crate",
  "Desk",
  "Door",
  "Drawer",
  "Frame",
  "Gear",
  "Hinge",
  "Hook",
  "Knob",
  "Lamp",
  "Latch",
  "Lever",
  "Nail",
  "Panel",
  "Pipe",
  "Pump",
  "Rope",
  "Shelf",
  "Spring",
  "Tank",
  "Valve",
  "Wagon",
  "Wheel",
] as const;

export type LibraryShapedNoun = (typeof LIBRARY_SHAPED_NOUNS)[number];

export type LibraryShapedNouns = {
  seed: number;
  parent: LibraryShapedNoun;
  child: LibraryShapedNoun;
};

export type LibraryShapedNames = {
  parentCamel: string;
  childCamel: string;
  parentTable: string;
  childTable: string;
  parentId: string;
  childId: string;
  createOperationId: string;
  getOperationId: string;
  collectionPath: string;
  itemPath: string;
  honoItemPath: string;
};

export type LibraryShapedContractSample = {
  nouns: LibraryShapedNouns;
  names: LibraryShapedNames;
  contract: ContractArtifact;
  openApi: Record<string, unknown>;
  modules: GeneratedApicalModules;
};

const nounCount = LIBRARY_SHAPED_NOUNS.length;

export function pickLibraryShapedNouns(seed: number): LibraryShapedNouns {
  const rng = xoroshiro128plus(seed >>> 0);
  const parentIndex = uniformInt(rng, 0, nounCount - 1);
  const childShift = uniformInt(rng, 1, nounCount - 1);
  const childIndex = (parentIndex + childShift) % nounCount;

  return {
    seed: seed >>> 0,
    parent: LIBRARY_SHAPED_NOUNS[parentIndex]!,
    child: LIBRARY_SHAPED_NOUNS[childIndex]!,
  };
}

export function libraryShapedNames(nouns: LibraryShapedNouns): LibraryShapedNames {
  const parentCamel = toCamelCase(nouns.parent);
  const childCamel = toCamelCase(nouns.child);
  const parentTable = pluralizeCamel(parentCamel);
  const childTable = pluralizeCamel(childCamel);
  const parentId = `${parentCamel}Id`;
  const childId = `${childCamel}Id`;

  return {
    parentCamel,
    childCamel,
    parentTable,
    childTable,
    parentId,
    childId,
    createOperationId: `create${nouns.child}`,
    getOperationId: `get${nouns.child}`,
    collectionPath: `/${childTable}`,
    itemPath: `/${childTable}/{${childId}}`,
    honoItemPath: `/${childTable}/:${childId}`,
  };
}

export function createLibraryShapedOpenApi(nouns: LibraryShapedNouns): Record<string, unknown> {
  const {
    childTable: childPlural,
    parentTable: parentPlural,
    parentId,
    childId,
  } = libraryShapedNames(nouns);

  return {
    openapi: "3.1.0",
    info: {
      title: `${nouns.child} API`,
      version: "1.0.0",
    },
    paths: {
      [`/${childPlural}`]: {
        post: {
          operationId: `create${nouns.child}`,
          "x-hexkit": {
            operation: {
              aggregate: nouns.child,
              action: "create",
            },
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${nouns.child}` },
              },
            },
          },
          responses: {
            "201": {
              description: `${nouns.child} created`,
              content: {
                "application/json": {
                  schema: { $ref: `#/components/schemas/${nouns.child}` },
                },
              },
            },
          },
        },
      },
      [`/${childPlural}/{${childId}}`]: {
        get: {
          operationId: `get${nouns.child}`,
          parameters: [
            {
              name: childId,
              in: "path",
              required: true,
              schema: { type: "integer", format: "int32" },
            },
          ],
          responses: {
            "200": {
              description: `${nouns.child} found`,
              content: {
                "application/json": {
                  schema: { $ref: `#/components/schemas/${nouns.child}` },
                },
              },
            },
            "404": {
              description: `${nouns.child} not found`,
            },
          },
        },
      },
    },
    components: {
      schemas: {
        [nouns.parent]: {
          type: "object",
          "x-hexkit": {
            persistence: {
              table: parentPlural,
              identity: "id",
            },
          },
          required: ["id", "name"],
          properties: {
            id: { type: "integer", format: "int32" },
            name: { type: "string" },
          },
        },
        [nouns.child]: {
          type: "object",
          "x-hexkit": {
            persistence: {
              table: childPlural,
              identity: "id",
            },
          },
          required: ["id", parentId, "title"],
          properties: {
            id: { type: "integer", format: "int32" },
            [parentId]: {
              type: "integer",
              format: "int32",
              "x-hexkit": {
                reference: {
                  schema: nouns.parent,
                  property: "id",
                },
              },
            },
            title: { type: "string" },
          },
        },
      },
    },
  };
}

export function createLibraryShapedModules(nouns: LibraryShapedNouns): GeneratedApicalModules {
  return {
    schemas: new Map([
      [nouns.parent, `schemas/${nouns.parent}.ts`],
      [nouns.child, `schemas/${nouns.child}.ts`],
    ]),
    operations: new Map([
      [`create${nouns.child}`, `routes/create${nouns.child}.ts`],
      [`get${nouns.child}`, `routes/get${nouns.child}.ts`],
    ]),
  };
}

export function createSeededLibraryContract(seed: number): LibraryShapedContractSample {
  const nouns = pickLibraryShapedNouns(seed);
  const openApi = createLibraryShapedOpenApi(nouns);
  const modules = createLibraryShapedModules(nouns);

  return {
    nouns,
    names: libraryShapedNames(nouns),
    openApi,
    modules,
    contract: normalizeContractArtifact(openApi, modules),
  };
}

function toCamelCase(value: string): string {
  return `${value.slice(0, 1).toLowerCase()}${value.slice(1)}`;
}

function pluralizeCamel(value: string): string {
  return `${value}s`;
}
