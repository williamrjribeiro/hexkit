# Hexkit Injection Vulnerability Review

Scope: SQL injection, command injection, path traversal, template/code injection, SSRF, header injection, XML XXE/billion laughs, unsafe OpenAPI parsing, upload path traversal, CI expression injection.

Threat model: attacker-controlled OpenAPI document processed by `hexkit generate` (and/or HTTP clients of generated apps where noted).

Only **MEDIUM / HIGH / CRITICAL** findings are listed as confirmed. Rejected candidates follow.

---

## CRITICAL — Template/code injection via unsanitized OpenAPI identifiers

### Attack chain

1. Attacker supplies a malicious OpenAPI document (or Hexkit extensions on an otherwise-valid contract).
2. `@hexkit/plugin-apical` normalizes strings with `requiredString` only (non-empty); **no** identifier / path / SQL-safe validation.
3. Downstream generators interpolate those strings into TypeScript **without** `JSON.stringify` / escaping.
4. Generated modules are later imported/executed (`node src/runtime/server.ts`, Next route handlers, Drizzle schema import) → arbitrary JS runs in the generated app process.

### Evidence — sources

Operation IDs and paths accepted as raw strings:

```183:211:packages/plugin-apical/src/contract/operation-normalize.ts
      const operationId = requiredString(operation.operationId, `${location}.operationId`);
      // ...
      operations.push({
        operationId,
        method: method as ContractHttpMethod,
        path,
```

Property names taken from OpenAPI object keys with no sanitization:

```105:116:packages/plugin-apical/src/contract/type-normalize.ts
  return Object.entries(properties).map(([name, value]) => {
    const propertyLocation = `${location}.properties.${name}`;
    // ...
    return {
      name,
```

`x-hexkit.persistence.table` accepted as any non-empty string and used as both SQL name and JS export:

```39:44:packages/plugin-apical/src/contract/extensions.ts
  return {
    table: requiredString(persistence.table, `${location}.${extensionName}.persistence.table`),
    identity: requiredString(
```

```36:39:packages/plugin-drizzle/src/model/table.ts
  return {
    schemaName: schema.name,
    exportName: persistence.table,
    tableName: persistence.table,
```

`toKebabCase` / `splitIdentifier` strip non-alphanumerics for **some** file paths, but many sinks use raw values (contrast):

```25:32:packages/codegen/src/naming.ts
export function splitIdentifier(value: string): readonly string[] {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[^A-Za-z0-9]+/g, " ")
```

### Evidence — sinks

**Hono route registration** — path string breakout + statement injection via `operationId`:

```22:24:packages/plugin-hono/src/generate/routes/registrations.ts
    return [
      `  app.${operation.method}("${operation.honoPath}", async (context) =>`,
      `    respond(await controllers.${operation.operationId}(${controllerArguments}), context.req.header("accept")),`,
```

Payload examples:

- Path `/" ); require("fs").writeFileSync("/tmp/pwn","x"); //` → closes the string and injects statements into `routes.ts`.
- `operationId` `foo; require("child_process").execSync("id"); //` → `controllers.foo; require(...); //(…)`.

**Drizzle schema module** — `exportName` and property names execute at import time:

```92:96:packages/plugin-drizzle/src/generate/schema.ts
    return `  ${column.propertyName}: ${expression},`;
  });

  return [
    `export const ${table.exportName} = pgTable(${JSON.stringify(table.tableName)}, {`,
```

Payload examples:

- `x-hexkit.persistence.table` = `pets; require("fs").writeFileSync("/tmp/pwn","x"); const _`
- Property name = `x: (require("child_process").execSync("id"), text("t")), z` → object-literal expression injection beside `pgTable({...})`.

**HTTP controllers** — media type / XML root / status interpolated into double-quoted JS strings:

```229:239:packages/shared/src/render-controllers.ts
  const mediaType = operation.successMediaType ?? "application/json";
  const dataExpression =
    operation.successResponseHeaders.length > 0
      ? `${operation.responseMapName}["${operation.successStatus}"]["${mediaType}"].parse(result.data)`
      : `${operation.responseMapName}["${operation.successStatus}"]["${mediaType}"].parse(result)`;
  lines.push("      return {");
  lines.push(`        status: "${operation.successStatus}",`);
  lines.push(`        contentType: "${mediaType}",`);
  if (operation.successXmlRootName !== undefined) {
    lines.push(`        xmlRoot: "${operation.successXmlRootName}",`);
```

**Next route handlers** — raw `operationId` property access:

```54:54:packages/plugin-next/src/generate/routes.ts
    `    const result = await runtime.controllers.${method.operationId}(${controllerArguments});`,
```

**Next hub JSX** — unescaped `operationId` in generated source (JSX structure injection):

```108:111:packages/plugin-next/src/generate/pages.ts
  return [
    "        <li>",
    `          <Link href=${JSON.stringify(href)}>${page.operationId}</Link>`,
```

### Impact

RCE in the generated application process whenever generated runtime/schema modules load. Triggered by generating from a malicious OpenAPI and then starting/building the app (dogfood, Compose `start`, `next build`/dev).

### Notes

Content-type arrays in Hono registrations correctly use `JSON.stringify` (not vulnerable). Auth scheme literals in `security-render.ts` also use `JSON.stringify`. The gap is inconsistent escaping for identifiers, paths, media types, and table/export names.

---

## HIGH — Path traversal when writing generated Next files

### Attack chain

1. Malicious OpenAPI path contains `..` segments, e.g. `/../../outside/pwn`.
2. `openApiPathToNextSegments` splits on `/` and does **not** reject `.` / `..`.
3. `openApiPathToAppRouteFile` / `openApiPathToUiPageFile` produce `app/../../outside/pwn/route.ts` (or UI `page.tsx`).
4. `createFileWriter` joins with `outputDirectory` and writes with no containment check; CLI `mkdirSync`/`writeFileSync` follow the resolved path.

### Evidence

```52:57:packages/shared/src/openapi-path.ts
export function openApiPathToNextSegments(openApiPath: string): readonly string[] {
  return openApiPath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/^\{([^}]+)\}$/, "[$1]"));
}
```

```9:22:packages/plugin-next/src/model/paths.ts
export function openApiPathToAppRouteFile(openApiPath: string): string {
  const relativePath = openApiPathToAppRelativePath(openApiPath);
  return relativePath.length > 0 ? `app/${relativePath}/route.ts` : "app/route.ts";
}
// ...
  return relativePath.length > 0 ? `${prefix}/${relativePath}/page.tsx` : `${prefix}/page.tsx`;
```

```20:33:packages/core/src/file-writer.ts
export function createFileWriter(
  outputDirectory: string,
  actions: FileWriterActions,
): (file: GeneratedFile) => void {
  return (file: GeneratedFile) => {
    const outputPath = join(outputDirectory, file.path);
    // no resolve()+prefix check against outputDirectory
    actions.write(outputPath, file.contents);
```

```42:44:apps/cli/src/main.ts
    write(path: string, contents: string) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents, "utf8");
```

Verified: `join("/tmp/out", "app/../../etc/cron.d/pwn/route.ts")` → `/tmp/etc/cron.d/pwn/route.ts`.

### Impact

Arbitrary file write relative to the output directory (escape to parent trees). Attacker chooses contents of generated route/page modules (further code execution if those paths are later imported, or overwrite of sensitive files under reachable parents).

Hono generation writes fixed adapter paths (`routes.ts`, etc.), so this traversal sink is Next-primary; the shared file writer itself is unsafe for any plugin that emits `../` in `file.path`.

---

## HIGH — SQL injection in generated migration DDL (not runtime queries)

### Attack chain

1. Attacker sets `x-hexkit.persistence.table` to e.g. `pets"; DROP TABLE users; --`.
2. Value flows unsanitized into `table.tableName` / FK target table names.
3. Migration renderer embeds it inside double-quoted identifiers **without** escaping `"`.
4. Operator runs generated `migrate` (`psql … -f drizzle/0000_<slug>.sql`) → arbitrary SQL as the DB role.

### Evidence

```60:60:packages/plugin-drizzle/src/generate/migration.ts
  return [`CREATE TABLE IF NOT EXISTS "${table.tableName}" (`, ...body, ");"].join("\n");
```

```94:95:packages/plugin-drizzle/src/generate/migration.ts
  const constraintName = `${table.tableName}_${column.sqlName}_${foreignKey.targetTableExportName}_${foreignKey.targetColumnSqlName}_fk`;
  return `CONSTRAINT "${constraintName}"\n    FOREIGN KEY ("${column.sqlName}") REFERENCES "public"."${foreignKey.targetTableExportName}"("${foreignKey.targetColumnSqlName}")`;
```

Enum **values** are quote-escaped (`escapeSql`), and column `sqlName` goes through `toSnakeCase` (strips most metacharacters). Table names from the extension do not.

### Runtime SQL injection: not confirmed

Generated repositories use Drizzle `eq` / `inArray` / `.values()` with bound parameters (e.g. `list-filter.ts`, `repository.ts`). Request-time values are not concatenated into SQL strings. **Rejected as runtime SQLi.**

---

## Rejected candidates (below MEDIUM or not exploitable as framed)

| Candidate | Reason |
| --- | --- |
| **Command injection (spawn craft)** | `generate-contracts.ts` uses `spawn(process.execPath, [bin, ...args])` with argv array, `shell` unset. Paths cannot break out into shell metacharacters. |
| **Command injection (migrate scripts / package.json)** | `migrationPath` is `drizzle/0000_${slug}.sql`; `slugify` restricts to `[a-z0-9-]`. `databaseName` in Compose similarly slug-derived. |
| **scripts/\*.sh** | Dogfood wrappers `exec` fixed repo scripts; no OpenAPI-derived arguments. |
| **SSRF in generated apps** | No generated `fetch`/HTTP client of user-supplied URLs in Hono/Next runtimes reviewed. |
| **Header injection** | `respond` / `handleControllerResult` copy `result.headers` without CRLF filtering, but values come from controller/use-case results (not raw request headers). Node/undici `Response` rejects CR/LF in header values. No request→header sink found in generated defaults. |
| **XML XXE** | Generated `XMLParser({ ignoreAttributes: true, trimValues: true })` leaves `processEntities` default true, but `fast-xml-parser@5.11.2` does not resolve external `SYSTEM` entities. |
| **Billion laughs** | Same pin (≥ 5.3.6) applies expansion caps; classic unbounded DoS advisory does not apply to 5.11.2. Residual bounded CPU use is below MEDIUM for this review. |
| **Unsafe OpenAPI YAML file include / parser SSRF** | `loadValidatedOpenApi` uses `@readme/openapi-parser` `validate`/`bundle` without `resolve.file: true` (filesystem `$ref` disabled by default). Private/IMDS HTTP `$ref` targets are refused by current parser guards. Hexkit’s own `createRefResolver` also rejects non-`#/` refs post-bundle. |
| **Prototype pollution via YAML** | No custom `js-yaml` `load` with unsafe schema in Hexkit; parsing delegated to openapi-parser defaults. |
| **Upload path traversal (pet image)** | Binary uploads go to Drizzle blob store with `randomUUID()` keys in `hexkit_blobs`; no filesystem path from filename/Content-Disposition. |
| **CI expression injection** | `.github/workflows/ci.yml` only interpolates `github.workflow` / `github.ref` in `concurrency.group`; no `github.event.*` / PR title in `run:` scripts. |

---

## Cross-cutting root cause

Hexkit sanitizes inconsistently:

- **Safe patterns present:** `JSON.stringify` for content-types and some Drizzle SQL string args; `toKebabCase`/`toSnakeCase`/`slugify` for many paths and column SQL names; `escapeTemplateLiteral` for Compose listening banner; craft spawn without shell.
- **Missing:** a single `assertSafeIdentifier` / `assertSafeRelativePath` / SQL identifier escape applied at contract normalize time for `operationId`, OpenAPI paths, schema/property names, media types, response statuses, XML root names, and `x-hexkit.persistence.table`.

Recommended hardening (informational): reject or rewrite all contract-derived names to `[A-Za-z_][A-Za-z0-9_]*` (or quote via `JSON.stringify` everywhere they enter JS); reject path segments `.`/`..` and non-`[A-Za-z0-9_-]`; escape `"` in SQL identifiers; resolve generated paths with `path.resolve` and assert `relative(outputDir, resolved)` does not start with `..`.
