import { compareText } from "@hexkit/codegen";
import type { ContractMedia, ContractOperation } from "@hexkit/plugin-apical";

export function inferAggregateFromPath(
  path: string,
  schemaNames: ReadonlySet<string>,
): string | undefined {
  const schemasByLower = new Map(
    [...schemaNames].map((name) => [name.toLowerCase(), name] as const),
  );

  const segments = path
    .split("/")
    .filter((segment) => segment.length > 0 && !segment.startsWith("{"));

  for (const segment of [...segments].toReversed()) {
    for (const candidate of [segment, segment.replace(/s$/i, "")]) {
      const match = schemasByLower.get(candidate.toLowerCase());
      if (match !== undefined) return match;
    }
  }

  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    const parameterName = match[1] ?? "";
    if (!/id$/i.test(parameterName)) continue;
    const baseName = parameterName.replace(/id$/i, "");
    const schema = schemasByLower.get(baseName.toLowerCase());
    if (schema !== undefined) return schema;
  }

  return undefined;
}

export function resolveAggregate(
  operation: ContractOperation,
  schemaNames: ReadonlySet<string>,
): string {
  if (operation.extension?.aggregate !== undefined) {
    return operation.extension.aggregate;
  }

  const fromRequest = schemaReferenceFromMedia(operation.requestBody?.media);
  if (fromRequest !== undefined && schemaNames.has(fromRequest)) {
    return fromRequest;
  }

  for (const response of operation.responses) {
    if (!isSuccessStatus(response.status)) continue;
    const fromResponse = schemaReferenceFromMedia(response.media);
    if (fromResponse !== undefined && schemaNames.has(fromResponse)) {
      return fromResponse;
    }
  }

  const fromPath = inferAggregateFromPath(operation.path, schemaNames);
  if (fromPath !== undefined) {
    return fromPath;
  }

  throw new Error(
    `Cannot infer aggregate for operation "${operation.operationId}". Add x-hexkit.operation.aggregate.`,
  );
}

export function groupOperationsByAggregate(
  operations: readonly ContractOperation[],
  schemaNames: ReadonlySet<string>,
): ReadonlyArray<readonly [string, readonly ContractOperation[]]> {
  const groups = new Map<string, readonly ContractOperation[]>();

  for (const operation of operations) {
    const aggregate = resolveAggregate(operation, schemaNames);
    groups.set(aggregate, [...(groups.get(aggregate) ?? []), operation]);
  }

  return [...groups.entries()].sort(([left], [right]) => compareText(left, right));
}

export function isSuccessStatus(status: string): boolean {
  return /^2\d\d$/.test(status);
}

function schemaReferenceFromMedia(media: readonly ContractMedia[] | undefined): string | undefined {
  if (media === undefined) return undefined;
  for (const entry of media) {
    if (entry.type?.kind === "reference") {
      return entry.type.schema;
    }
  }
  return undefined;
}
