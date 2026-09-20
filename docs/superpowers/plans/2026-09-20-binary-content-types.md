# Binary request Content-Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept any OpenAPI request media with `string` + `format: binary` (not only `application/octet-stream`), derive a shared `RequestBodyTransport`, and pass a typed `contentType` union into hexagonal use cases alongside `Uint8Array`.

**Architecture:** Apical already keys `requestMap` by media type and uses `z.instanceof(Blob)` for binary schemas. Hexkit adds `deriveRequestBodyTransport` in `@hexkit/shared`; hexagonal/Hono/Next/drizzle consume it. `BlobStore.put` stays MIME-agnostic. No PetShop UI in this PR.

**Tech Stack:** TypeScript, Vite+ (`vp`), Vitest, Apical craft, Hono, Next App Router generators.

**Spec:** [2026-09-20-binary-content-types-design.md](../specs/2026-09-20-binary-content-types-design.md)

## Global Constraints

- Stack as a **follow-up** on BlobStore tip (`cursor/blobstore-next-upload-7f96` / #51) or on `main` after #49–#51 merge. **Do not rebase** #49–#51.
- Plugins stay domain-agnostic (PRD §5.0). Prove with `apps/fixtures/upload-api` — no Petstore strings in plugin tests.
- Schema-required binary only; empty `{}` media → generation error.
- Multiple binary media types allowed → string literal union.
- No new `x-hexkit` keys. No XML / form-urlencoded / multipart. No BlobStore MIME persistence. No Next PetShop upload UI.
- TDD: failing test → minimal implementation → focused package test → commit.
- Build before tests: `vp run --filter './packages/*' --filter './apps/cli' build`. Do not combine `--filter` with `-r`.
- Conventional Commits per task.

## File structure (planned touch list)

| Path                                                              | Role                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| `packages/shared/src/request-body-transport.ts`                   | `deriveRequestBodyTransport`                          |
| `packages/shared/src/media.ts`                                    | Thin wrappers or deprecate direct octet-stream finder |
| `packages/shared/src/controller-binding.ts`                       | Carry `contentTypes` / transport                      |
| `packages/shared/src/use-case-args.ts`                            | Emit `contentType` + body expressions                 |
| `packages/plugin-architecture-hexagonal/src/model/parameters.ts`  | `contentType` union + `Uint8Array`                    |
| `packages/plugin-architecture-hexagonal/src/generate/use-case.ts` | Factory arg order                                     |
| `packages/plugin-hono/src/generate/routes/static-runtime.ts`      | Allowlist CT → Apical                                 |
| `packages/plugin-next/src/generate/helpers.ts`                    | Same                                                  |
| `packages/plugin-drizzle/src/model/repository.ts`                 | Use shared binary detection                           |
| `apps/fixtures/upload-api/openapi.yaml`                           | Multi-CT binary body                                  |
| `apps/cli/src/upload-generation.test.ts`                          | Assert contentType union                              |

---

### Task 1: Extend upload-api fixture with multi-CT binary

**Files:**

- Modify: `apps/fixtures/upload-api/openapi.yaml`

**Interfaces:**

- Produces: `uploadDocument` requestBody with `application/octet-stream`, `image/png`, and `image/jpeg`, each `{ type: string, format: binary }`.

- [ ] **Step 1: Update requestBody content**

```yaml
requestBody:
  required: true
  content:
    application/octet-stream:
      schema:
        type: string
        format: binary
    image/png:
      schema:
        type: string
        format: binary
    image/jpeg:
      schema:
        type: string
        format: binary
```

Keep existing path/query/`UploadReceipt`/`Document` unchanged. Ensure `x-hexkit.operation.action: insert` remains.

- [ ] **Step 2: Commit**

```bash
git add apps/fixtures/upload-api/openapi.yaml
git commit -m "test(fixture): declare multi content-type binary upload body"
```

---

### Task 2: Shared — `deriveRequestBodyTransport`

**Files:**

- Create: `packages/shared/src/request-body-transport.ts`
- Create: `packages/shared/src/request-body-transport.test.ts`
- Modify: `packages/shared/src/media.ts` (implement `hasBinaryRequestBody` / `findOctetStreamMedia` via transport or replace call sites)
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/controller-binding.ts`
- Modify: `packages/shared/src/use-case-args.ts`
- Tests: existing media / use-case-args / controller-binding tests

**Interfaces:**

- Produces:
  ```ts
  export type RequestBodyTransport =
    | { kind: "none" }
    | { kind: "json"; contentTypes: readonly string[] }
    | { kind: "binary"; contentTypes: readonly [string, ...string[]] };

  export function deriveRequestBodyTransport(operation: ContractOperation): RequestBodyTransport;
  ```
- Binary media: `type.kind === "string" && type.format === "binary"`.
- Empty schema media when `requestBody` present and no typed json/binary → throw.
- JSON + binary → throw.
- `deriveUseCaseArgumentExpressions`: for binary, append `"request.value.contentType"` then body expression (Blob → Uint8Array as today).
- Controller binding exposes `requestBodyTransport` or `binaryContentTypes: readonly string[]`.

- [ ] **Step 1: Write failing tests**

```ts
it("derives binary transport with all format:binary media types", () => {
  const transport = deriveRequestBodyTransport(uploadOpWithPngAndOctet);
  expect(transport).toEqual({
    kind: "binary",
    contentTypes: ["application/octet-stream", "image/png", "image/jpeg"],
  });
});

it("rejects typeless media-only request bodies", () => {
  expect(() => deriveRequestBodyTransport(opWithImagePngEmpty)).toThrow(/schema|format: binary/i);
});
```

Adapt builders to existing `ContractOperation` test helpers.

- [ ] **Step 2: Run — expect FAIL**

```bash
vp run --filter './packages/*' --filter './apps/cli' build
vp run --filter @hexkit/shared test
```

- [ ] **Step 3: Implement transport + wire args/binding**

Prefer updating all in-repo call sites of `hasBinaryRequestBody` to use `transport.kind === "binary"` in the same PR when feasible; otherwise keep wrappers:

```ts
export function hasBinaryRequestBody(operation: ContractOperation): boolean {
  return deriveRequestBodyTransport(operation).kind === "binary";
}
```

Remove octet-stream equality from binary detection (wrappers must not require octet-stream).

- [ ] **Step 4: Tests PASS; commit**

```bash
vp run --filter @hexkit/shared test
git add packages/shared
git commit -m "feat(shared): derive RequestBodyTransport for binary content types"
```

---

### Task 3: Hexagonal — `contentType` parameter + factory order

**Files:**

- Modify: `packages/plugin-architecture-hexagonal/src/model/parameters.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/model/use-case.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/generate/use-case.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/plugin.test.ts` (upload-api expectations)
- Tests: `parameters.test.ts`, `generate` / plugin tests

**Interfaces:**

- Binary ops add parameter:
  `{ name: "contentType", typeExpression: '"application/octet-stream" | "image/png" | "image/jpeg"', location: "header" /* or dedicated "contentType" */ }`
- Prefer `location: "contentType"` if existing location union can extend; else document as synthetic (not OpenAPI param).
- Transport parameter order: path → query → contentType → body.
- Repo params still exclude contentType and body (metadata insert unchanged).
- `renderBlobStoreFactory` passes `contentType` into the closure (may `void contentType` for v1).

- [ ] **Step 1: Failing test — contentType union on uploadDocument**

```ts
expect(parameters.map((p) => [p.name, p.typeExpression])).toContainEqual([
  "contentType",
  '"application/octet-stream" | "image/png" | "image/jpeg"',
]);
```

(Exact quote style must match codebase string-literal rendering helpers.)

- [ ] **Step 2: Implement; update plugin inline snapshot for createUploadDocument**

- [ ] **Step 3: Tests PASS; commit**

```bash
vp run --filter @hexkit/plugin-architecture-hexagonal test
git add packages/plugin-architecture-hexagonal
git commit -m "feat(hexagonal): typed contentType on binary upload use cases"
```

---

### Task 4: Hono + Next — allowlist Content-Type

**Files:**

- Modify: `packages/plugin-hono/src/generate/routes/static-runtime.ts`
- Modify: `packages/plugin-hono/src/generate/routes/registrations.ts` (pass contentTypes into helper)
- Modify: `packages/plugin-next/src/generate/helpers.ts`
- Modify: `packages/plugin-next/src/generate/routes.ts`
- Modify: plugin tests using upload-api

**Interfaces:**

- Generated `binaryRequest` takes declared `contentTypes: readonly string[]`.
- Normalize header with `split(";", 1)[0]?.trim().toLowerCase()`; compare case-insensitively to declared types (store declared types lowercased or compare with equality after normalize).
- On match, set Apical `contentType` to the **canonical declared** string (preserve OpenAPI casing from IR).
- Reject undeclared types (e.g. `image/gif`).

- [ ] **Step 1: Failing plugin test — generated helper lists image/png**

- [ ] **Step 2: Implement allowlist + forward CT**

- [ ] **Step 3: Tests PASS; commit**

```bash
vp run --filter @hexkit/plugin-hono test
vp run --filter @hexkit/plugin-next test
git add packages/plugin-hono packages/plugin-next
git commit -m "feat(http): validate binary Content-Type against contract media"
```

---

### Task 5: Drizzle — shared binary detection

**Files:**

- Modify: `packages/plugin-drizzle/src/model/repository.ts` (remove local octet-stream-only `isBinaryUploadOperation`)
- Test: plugin tests still pass for upload-api

- [ ] **Step 1: Switch to `hasBinaryRequestBody` / transport from `@hexkit/shared`**

- [ ] **Step 2: `vp run --filter @hexkit/plugin-drizzle test` PASS; commit**

```bash
git commit -m "refactor(drizzle): detect binary uploads via shared transport"
```

---

### Task 6: CLI proof + quality gate

**Files:**

- Modify: `apps/cli/src/upload-generation.test.ts`

- [ ] **Step 1: Assert generated use case contains contentType union and body**

```ts
expect(useCase).toMatch(
  /contentType:\s*"application\/octet-stream"\s*\|\s*"image\/png"\s*\|\s*"image\/jpeg"/,
);
expect(useCase).toContain("Uint8Array");
```

- [ ] **Step 2: Run**

```bash
vp run --filter './packages/*' --filter './apps/cli' build
vp check
vp run --filter './packages/*' --filter './apps/cli' test
vp run coverage   # if drizzle/shared thresholds need a glance
```

- [ ] **Step 3: Commit; open PR** against BlobStore tip or `main` post-merge

```bash
git commit -m "test(cli): prove multi content-type binary upload generation"
```

Optional: if Petstore dogfood still green without contract change, no tracker edit. If you add image/* to `openapi.poc.yaml` in this PR, update tracker Notes in the same commit.

---

## Self-review checklist (agents)

- [ ] Binary detection no longer requires `application/octet-stream`
- [ ] Empty `{}` media rejected
- [ ] Multi-CT union on use case + HTTP allowlist
- [ ] BlobStore API unchanged
- [ ] No Next PetShop UI
- [ ] No rebase of #49–#51

## Execution handoff

**Plan complete.** Implement after BlobStore stack tip is available as base.

1. **Subagent-Driven (recommended)** — one subagent per task
2. **Inline Execution** — same session with checkpoints

Which approach?
