import { describe, expect, it } from "vite-plus/test";

import type { HttpAuthSchemeBinding } from "./auth-schemes.ts";
import {
  collectApiKeyHeaderNames,
  renderApiKeyDefaultsMapLiteral,
  renderSecurityMetaLiteral,
} from "./security-render.ts";

const apiKey: HttpAuthSchemeBinding = {
  name: "api_key",
  type: "apiKey",
  headerName: "X-API-Key",
};

const bearer: HttpAuthSchemeBinding = {
  name: "bearerAuth",
  type: "http",
  scheme: "bearer",
  headerName: "Authorization",
};

describe("Given auth scheme render calculations", () => {
  it("when schemes are mixed, then security metadata keeps both literals", () => {
    expect(renderSecurityMetaLiteral([bearer, apiKey])).toBe(
      '{ schemes: [{ name: "bearerAuth", type: "http", scheme: "bearer", headerName: "Authorization" }, { name: "api_key", type: "apiKey", headerName: "X-API-Key" }] }',
    );
  });

  it("when no schemes exist, then the metadata object has an empty list", () => {
    expect(renderSecurityMetaLiteral([])).toBe("{ schemes: [] }");
  });

  it("when apiKey headers repeat with different casing, then defaults keep the first lowercased name", () => {
    expect(
      collectApiKeyHeaderNames([
        apiKey,
        { name: "duplicate", type: "apiKey", headerName: "x-api-key" },
        bearer,
      ]),
    ).toEqual(["x-api-key"]);
    expect(renderApiKeyDefaultsMapLiteral([])).toBe("[]");
    expect(renderApiKeyDefaultsMapLiteral([apiKey])).toBe(
      '[["x-api-key", new Set((process.env.AUTH_API_KEYS ?? "test-key").split(","))]]',
    );
  });
});
