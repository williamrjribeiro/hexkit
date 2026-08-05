# OpenAPI Authentication Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add contract-first API authentication to Hexkit so OpenAPI security schemes drive Apical header validation, hexagonal `Principal` / `Authenticator` wiring, and correct HTTP 401 behavior — without breaking the auth-free PoC.

**Architecture:** Extend `plugin-apical`’s `ContractArtifact` with security IR mirroring Apical’s header-based rules. `plugin-architecture-hexagonal` emits a minimal `Principal` type and passes it into secured use cases. `plugin-hono` maps auth header validation failures to 401, extracts credentials, calls an `Authenticator` port, and emits a stub auth adapter. Verification stays in adapters; domain never sees Hono or raw headers.

**Tech Stack:** TypeScript, Vite+, Vitest, `@apical-ts/craft`, Hono, Zod (via Apical), existing Hexkit plugin pipeline.

**Design spec:** [`docs/superpowers/specs/2026-08-05-openapi-auth-design.md`](../specs/2026-08-05-openapi-auth-design.md)

## Global Constraints

- PoC authority remains `PRD.md`: leave `apps/petstore-sample/openapi.poc.yaml` **auth-free** and keep existing PoC dogfood green.
- Plugins must stay domain-agnostic (PRD §5.0 / RFC): no Petstore/`api_key` literals baked into `@hexkit/plugin-*`; fixtures live under `apps/`.
- Do **not** invent parallel header Zod schemas — Apical craft output is authoritative for wire validation.
- v1 schemes only: `apiKey` + `in: header`, and `http` + `scheme: bearer`. Mark other schemes `unsupported` in IR.
- Avoid OpenAPI OR multi-scheme requirements in fixtures until Apical’s AND merge is addressed upstream.
- Calculation/action separation: pure normalize/derive functions; I/O at plugin edges only.
- Test-first: failing BDD/Vitest test → minimal implementation → `vp check` / focused `vp test`.
- Conventional Commits per task.

## File map (what each new/changed unit owns)

| Path | Responsibility |
| ---- | -------------- |
| `packages/plugin-apical/src/contract/types.ts` | Security IR types on artifact/operations |
| `packages/plugin-apical/src/contract/security.ts` | Pure OpenAPI → effective security normalize (Apical-parity) |
| `packages/plugin-apical/src/contract/normalize.ts` | Wire security into artifact/operations |
| `packages/plugin-apical/src/contract/security.test.ts` | Normalize + Apical golden parity tests |
| `apps/fixtures/auth-api/openapi.yaml` | Domain-agnostic auth dogfood contract |
| `packages/plugin-architecture-hexagonal/src/generate/principal.ts` | Emit `Principal` domain type |
| `packages/plugin-architecture-hexagonal/src/generate/authenticator-port.ts` | Emit `Authenticator` port |
| `packages/plugin-architecture-hexagonal/src/generate/use-case.ts` | Secured use cases take `Principal` first arg |
| `packages/plugin-architecture-hexagonal/src/model/derive.ts` | Derive which ops need principal |
| `packages/plugin-hono/src/generate/controllers.ts` | 401 vs 400; authenticate then invoke |
| `packages/plugin-hono/src/generate/auth-adapter.ts` | Stub in-memory authenticator adapter |
| `packages/plugin-hono/src/generate/routes.ts` / `runtime.ts` | Wire authenticator into app factory |
| `apps/cli/src/auth-generation.test.ts` | Integration: generate auth-api and assert artifacts |

---

### Task 1: Security IR types and pure normalizer

**Files:**
- Create: `packages/plugin-apical/src/contract/security.ts`
- Create: `packages/plugin-apical/src/contract/security.test.ts`
- Modify: `packages/plugin-apical/src/contract/types.ts`
- Modify: `packages/plugin-apical/src/contract/index.ts` (re-export if needed)
- Create: `apps/fixtures/auth-api/openapi.yaml` (minimal fixture for tests)

**Interfaces:**
- Consumes: raw OpenAPI document (`Record<string, unknown>` / validated bundle)
- Produces:

```ts
export type ContractSecurityScheme =
  | { name: string; type: "apiKey"; in: "header"; headerName: string }
  | {
      name: string;
      type: "http";
      scheme: "bearer";
      headerName: "Authorization";
      bearerFormat?: string;
    }
  | { name: string; type: "unsupported"; openApiType: string; reason: string };

export type ContractSecurityRequirement = {
  schemes: readonly string[];
  scopes: Readonly<Record<string, readonly string[]>>;
};

export type ContractOperationSecurity = {
  overridesGlobal: boolean;
  requirements: readonly ContractSecurityRequirement[];
  apicalServerHeaderNames: readonly string[];
};

export function normalizeSecuritySchemes(
  document: Record<string, unknown>,
): readonly ContractSecurityScheme[];

export function normalizeGlobalSecurity(
  document: Record<string, unknown>,
): readonly ContractSecurityRequirement[];

export function resolveOperationSecurity(
  document: Record<string, unknown>,
  operation: Record<string, unknown>,
  schemes: readonly ContractSecurityScheme[],
  globalSecurity: readonly ContractSecurityRequirement[],
): ContractOperationSecurity;
```

- [ ] **Step 1: Write the failing tests**

Create `apps/fixtures/auth-api/openapi.yaml`:

```yaml
openapi: 3.1.0
info:
  title: Auth API Fixture
  version: 1.0.0
security:
  - bearerAuth: []
paths:
  /health:
    get:
      operationId: getHealth
      security: []
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok: { type: boolean }
  /items:
    get:
      operationId: listItems
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Item"
    post:
      operationId: createItem
      security:
        - apiKey: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Item"
      responses:
        "201":
          description: created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Item"
components:
  schemas:
    Item:
      type: object
      required: [id, name]
      properties:
        id: { type: string }
        name: { type: string }
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKey:
      type: apiKey
      name: X-API-Key
      in: header
    petstore_auth:
      type: oauth2
      flows:
        implicit:
          authorizationUrl: https://example.com/oauth/authorize
          scopes:
            read: read items
```

In `security.test.ts`, assert:

```ts
it("when global bearer is set, then listItems requires authorization server header", () => {
  // resolveOperationSecurity for listItems
  // expect apicalServerHeaderNames to equal ["authorization"] (lowercase to match Apical server schemas)
});

it("when security is empty, then getHealth has no auth headers", () => {
  // requirements [] and apicalServerHeaderNames []
});

it("when operation overrides with apiKey, then createItem requires x-api-key only", () => {
  // apicalServerHeaderNames ["x-api-key"]
});

it("when oauth2 scheme is declared, then it is marked unsupported", () => {
  // schemes includes { type: "unsupported", openApiType: "oauth2", ... }
});
```

- [ ] **Step 2: Run focused test — expect FAIL**

Run: `vp test run packages/plugin-apical/src/contract/security.test.ts`

Expected: FAIL (module/types missing).

- [ ] **Step 3: Implement types + pure normalizer**

Mirror Apical rules from the design spec §2:

- Header-based schemes only contribute to `apicalServerHeaderNames`.
- `security: []` → no headers.
- Missing `security` → inherit global header-based schemes.
- Override with named schemes → those schemes’ headers, required.
- Lowercase header names in `apicalServerHeaderNames` to match Apical `*ServerHeadersSchema` keys.
- `oauth2` / `openIdConnect` / `mutualTLS` / non-header apiKey → `unsupported`.

- [ ] **Step 4: Re-run tests — expect PASS**

Run: `vp test run packages/plugin-apical/src/contract/security.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fixtures/auth-api/openapi.yaml \
  packages/plugin-apical/src/contract/types.ts \
  packages/plugin-apical/src/contract/security.ts \
  packages/plugin-apical/src/contract/security.test.ts \
  packages/plugin-apical/src/contract/index.ts
git commit -m "feat(plugin-apical): add OpenAPI security IR normalizer"
```

---

### Task 2: Wire security into ContractArtifact + Apical golden parity

**Files:**
- Modify: `packages/plugin-apical/src/contract/normalize.ts`
- Modify: `packages/plugin-apical/src/contract/types.ts` (`ContractArtifact`, `ContractOperation`)
- Modify: `packages/plugin-apical/src/contract/security.test.ts` (or new `security.parity.test.ts`)
- Modify: any snapshots that serialize full artifacts

**Interfaces:**
- Consumes: `normalizeSecuritySchemes`, `normalizeGlobalSecurity`, `resolveOperationSecurity`
- Produces: `ContractArtifact` with `securitySchemes`, `globalSecurity`; each `ContractOperation.security`

```ts
export type ContractArtifact = {
  artifactVersion: 1; // keep 1 if additive+required fields are always populated; otherwise bump and migrate readers
  // ...existing fields...
  securitySchemes: readonly ContractSecurityScheme[];
  globalSecurity: readonly ContractSecurityRequirement[];
  operations: readonly ContractOperation[]; // each includes security
};
```

- [ ] **Step 1: Write failing normalize integration test**

Assert `normalizeContractArtifact(authOpenApi, generatedModules)` includes security fields for `listItems` / `getHealth` / `createItem`.

Add **Apical golden parity** test:

```ts
it("when craft emits server header schemas, then IR apicalServerHeaderNames match schema keys", async () => {
  // run craft (or fixture craft output) for apps/fixtures/auth-api/openapi.yaml
  // parse listItemsServerHeadersSchema object keys
  // expect deep equality with artifact.operations.find(listItems).security.apicalServerHeaderNames
});
```

- [ ] **Step 2: Run test — expect FAIL** (operations lack `security`)

- [ ] **Step 3: Update `normalizeOperations` / `normalizeContractArtifact` to attach security**

Update `hexkit-contract.json` emission automatically via existing stringify of artifact.

Fix downstream TypeScript breakages that construct `ContractOperation` / `ContractArtifact` in tests by adding empty security for auth-free fixtures:

```ts
security: { overridesGlobal: false, requirements: [], apicalServerHeaderNames: [] }
```

- [ ] **Step 4: Run plugin-apical tests + `vp check`**

Run: `vp test run packages/plugin-apical && vp check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-apical
git commit -m "feat(plugin-apical): attach security metadata to contract artifact"
```

---

### Task 3: Hexagonal Principal + Authenticator port

**Files:**
- Create: `packages/plugin-architecture-hexagonal/src/generate/principal.ts`
- Create: `packages/plugin-architecture-hexagonal/src/generate/authenticator-port.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/generate/files.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/model/derive.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/artifact.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/generate/use-case.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/plugin.test.ts`

**Interfaces:**
- Consumes: `ContractOperation.security`
- Produces:

```ts
// emitted src/core/domain/principal.ts
export type Principal = {
  id: string;
  scheme: string;
  scopes: readonly string[];
};

// emitted src/core/ports/authenticator.ts
export type AuthCredentials =
  | { kind: "bearer"; token: string }
  | { kind: "apiKey"; headerName: string; apiKey: string };

export type Authenticator = {
  authenticate(credentials: AuthCredentials): Promise<Principal | null>;
};
```

Use-case change for secured ops only:

```ts
export type CreateItem = (principal: Principal, item: Item) => Promise<Item>;
```

Public ops unchanged (no `Principal` parameter).

- [ ] **Step 1: Write failing plugin test**

Using auth-api contract artifact (built in-memory or via normalize):

```ts
it("when an operation requires security, then the use case type accepts Principal first", async () => {
  // expect generated create-item use case source to contain "principal: Principal"
});

it("when an operation is public, then the use case type has no Principal", async () => {
  // getHealth factory/type has no Principal
});

it("when any secured operation exists, then principal and authenticator port files are emitted", async () => {
  // paths exist in writeFile calls
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement derive + generators**

Rules:

- `requiresAuth = operation.security.apicalServerHeaderNames.length > 0` (aligned with Apical server enforcement).
- Emit `principal.ts` + `authenticator.ts` only if at least one operation requires auth (keeps PoC output unchanged).
- Application artifact may add:

```ts
authenticatorPort?: { name: "Authenticator"; filePath: "src/core/ports/authenticator.ts" };
```

- [ ] **Step 4: Run hexagonal + apical tests; confirm PoC-shaped fixtures still omit auth files**

Run: `vp test run packages/plugin-architecture-hexagonal packages/plugin-apical`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-architecture-hexagonal
git commit -m "feat(hexagonal): generate Principal and Authenticator port for secured ops"
```

---

### Task 4: Hono 401 mapping + authenticator wiring

**Files:**
- Modify: `packages/plugin-hono/src/artifact.ts`
- Modify: `packages/plugin-hono/src/model/derive.ts`
- Modify: `packages/plugin-hono/src/generate/controllers.ts`
- Modify: `packages/plugin-hono/src/generate/routes.ts`
- Modify: `packages/plugin-hono/src/generate/runtime.ts`
- Create: `packages/plugin-hono/src/generate/auth-adapter.ts`
- Modify: `packages/plugin-hono/src/generate/files.ts`
- Modify: `packages/plugin-hono/src/plugin.test.ts`

**Interfaces:**
- Consumes: `ContractOperation.security`, application authenticator port path, Apical wrappers
- Produces: Hono **auth middleware** (typed `Variables`) + controllers that pass `c.var.principal` into secured use cases; auth failures → HTTP 401

Hono-aligned shape (preferred over authenticating inside every controller):

```ts
type AppVariables = { principal: Principal };

export function createAuthenticateMiddleware(
  authenticator: Authenticator,
  securityMeta: OperationSecurityMeta,
) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const credentials = extractCredentials(c.req.raw.headers, securityMeta);
    if (!credentials) return c.json({ error: "Unauthorized" }, 401);
    const principal = await authenticator.authenticate(credentials);
    if (!principal) return c.json({ error: "Unauthorized" }, 401);
    c.set("principal", principal);
    await next();
  });
}

// Secured route registration
app.post("/items", authenticateCreateItem, async (context) =>
  respond(await controllers.createItem(await jsonRequest(context), context.var.principal)),
);

// Controller still uses Apical wrapper for contract validation; secured handlers receive Principal
createItem: createItemWrapper(async (request, principal) => {
  if (!request.isValid) {
    if (request.kind === "headers-error") throw new AuthenticationError("headers-error");
    throw new RequestValidationError(request.kind);
  }
  const result = await useCases.createItem(principal, request.value.body);
  // ...response mapping
}),
```

```ts
export class AuthenticationError extends Error {
  constructor(kind: string) {
    super(`Authentication failed: ${kind}`);
    this.name = "AuthenticationError";
  }
}
```

Routes `onError` still maps `AuthenticationError` → 401 as a safety net for Apical header-shape failures after middleware.

Auth adapter stub (`src/adapters/auth/in-memory-authenticator.ts`, ownership `generated`):

```ts
export function createInMemoryAuthenticator(options: {
  bearerTokens?: ReadonlySet<string>;
  apiKeys?: ReadonlyMap<string, ReadonlySet<string>>; // headerName → keys
}): Authenticator {
  return {
    async authenticate(credentials) {
      if (credentials.kind === "bearer") {
        if (!options.bearerTokens?.has(credentials.token)) return null;
        return { id: "bearer-user", scheme: "bearerAuth", scopes: [] };
      }
      const allowed = options.apiKeys?.get(credentials.headerName.toLowerCase());
      if (!allowed?.has(credentials.apiKey)) return null;
      return { id: "api-key-user", scheme: "apiKey", scopes: [] };
    },
  };
}
```

Credential extraction must use IR (`type: "http"|"apiKey"`, header names), stripping a leading `Bearer ` prefix for bearer tokens.

Runtime factory gains `authenticator: Authenticator` when any secured op exists; PoC runtime signature stays unchanged when IR has no security.

Prefer optional authenticator arg to minimize PoC churn:

```ts
export function createHttpControllers(
  useCases: HttpUseCases,
  authenticator?: Authenticator,
)
```

Secured entries must throw if `authenticator` is missing.

- [ ] **Step 1: Write failing Hono plugin tests**

```ts
it("when headers-error occurs on a secured operation, then AuthenticationError is thrown", () => {
  // snapshot or string contains AuthenticationError + headers-error
});

it("when validation fails on body, then RequestValidationError remains", () => { /* ... */ });

it("when secured ops exist, then runtime wires createInMemoryAuthenticator", () => { /* ... */ });

it("when contract has no security, then no auth adapter file is emitted", () => { /* PoC contract */ });
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement derive flags + generators**

- [ ] **Step 4: Run hono + hexagonal + cli library tests**

Run: `vp test run packages/plugin-hono packages/plugin-architecture-hexagonal apps/cli && vp check`

Expected: PASS; PoC paths unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-hono
git commit -m "feat(plugin-hono): wire Authenticator and map auth failures to 401"
```

---

### Task 5: Auth fixture dogfood + generation matrix

**Files:**
- Ensure: `apps/fixtures/auth-api/openapi.yaml` (from Task 1)
- Create: `apps/cli/src/auth-generation.test.ts`

**Interfaces:**
- Consumes: full CLI pipeline with `apps/fixtures/auth-api/openapi.yaml`
- Produces: generated app asserting paths and source fragments for Principal, Authenticator, 401 wiring

Expected request matrix (document for later Compose/Pactum; this task asserts generation + optional in-process checks):

| Request | Expected |
| ------- | -------- |
| `GET /health` no auth | 200 |
| `GET /items` no `Authorization` | 401 |
| `GET /items` with `Authorization: Bearer good` | 200 |
| `GET /items` with `Authorization: Bearer bad` | 401 |
| `POST /items` with only bearer (wrong scheme) | 401 |
| `POST /items` with `X-API-Key: good` | 201 |

- [ ] **Step 1: Write failing CLI/auth generation test**

```ts
expect(files).toContain("src/core/domain/principal.ts");
expect(files).toContain("src/core/ports/authenticator.ts");
expect(files).toContain("src/adapters/auth/in-memory-authenticator.ts");
expect(controllers).toContain("AuthenticationError");
expect(createItemUseCase).toContain("principal: Principal");
expect(getHealthUseCase).not.toContain("principal: Principal");
```

- [ ] **Step 2: Run — expect FAIL** if gaps remain

- [ ] **Step 3: Fix end-to-end gaps** (runtime exports, import paths, env defaults)

Default dogfood env in generated runtime:

```ts
createInMemoryAuthenticator({
  bearerTokens: new Set((process.env.AUTH_BEARER_TOKENS ?? "test-token").split(",")),
  apiKeys: new Map([
    ["x-api-key", new Set((process.env.AUTH_API_KEYS ?? "test-key").split(","))],
  ]),
});
```

- [ ] **Step 4: Run full verification**

Run: `vp run -r test && vp check && vp run -r build`

Expected: all PASS; existing petstore PoC tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fixtures/auth-api apps/cli
git commit -m "test: dogfood OpenAPI auth fixture through Hexkit generation"
```

---

### Task 6: Docs sync (RFC/PRD follow-up note)

**Files:**
- Modify: `PRD.md` §11 follow-ups (point to design; clarify v1 scope)
- Modify: `docs/README.md` to link the new spec/plan
- Optional: short Authentication note in `RFC.md` under Architectural Principles

- [ ] **Step 1: Add concise PRD follow-up amendment**

Replace vague “Auth plugins (OAuth, API keys)” with:

```markdown
- Authentication (post-PoC): see `docs/superpowers/specs/2026-08-05-openapi-auth-design.md`.
  v1 = OpenAPI `apiKey` header + HTTP bearer → Apical header validation + hexagonal `Authenticator`/`Principal`.
  Deferred: OAuth/OIDC flows, mutualTLS, scope 403 engine, `plugin-auth` extraction, SST authorizers.
```

- [ ] **Step 2: Link docs from `docs/README.md`**

- [ ] **Step 3: Run `vp check`**

- [ ] **Step 4: Commit**

```bash
git add PRD.md docs/README.md RFC.md
git commit -m "docs: record post-PoC OpenAPI auth design and plan"
```

---

## Self-review checklist (plan author)

1. **Spec coverage:** IR (§5.2) → Tasks 1–2; hexagonal (§5.3) → Task 3; Hono (§5.4–5.5) → Task 4; dogfood (§5.7) → Task 5; non-goals documented → Task 6 / Global Constraints.
2. **Placeholders:** None intentional; implementers must use concrete fixture paths above.
3. **Type consistency:** `Principal`, `Authenticator`, `AuthCredentials`, `AuthenticationError`, `apicalServerHeaderNames` naming is stable across tasks.
4. **PoC safety:** Tasks explicitly require auth-free PoC output and unchanged `openapi.poc.yaml`.
