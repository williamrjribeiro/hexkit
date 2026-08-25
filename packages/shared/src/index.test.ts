import { describe, expect, it } from "vite-plus/test";

import {
  collectApiKeyHeaderNames,
  deriveAuthSchemes,
  deriveHttpControllerBinding,
  deriveUseCaseArgumentExpressions,
  extractOpenApiPathParamNames,
  findJsonMedia,
  findSuccessResponse,
  hasJsonRequestBody,
  hasNotFoundResponse,
  IN_MEMORY_AUTH_ADAPTER_PATH,
  isSuccessStatus,
  openApiPathToHonoPath,
  openApiPathToNextSegments,
  renderApiKeyDefaultsMapLiteral,
  renderHttpControllersFile,
  renderInMemoryAuthAdapterFile,
  renderSecurityMetaLiteral,
} from "./index.ts";

describe("Given the @hexkit/shared public API", () => {
  it("when imported from the package barrel, then calculations and renderers are functions", () => {
    expect(IN_MEMORY_AUTH_ADAPTER_PATH).toBe("src/adapters/auth/in-memory-authenticator.ts");
    expect(typeof isSuccessStatus).toBe("function");
    expect(typeof findJsonMedia).toBe("function");
    expect(typeof findSuccessResponse).toBe("function");
    expect(typeof hasJsonRequestBody).toBe("function");
    expect(typeof hasNotFoundResponse).toBe("function");
    expect(typeof extractOpenApiPathParamNames).toBe("function");
    expect(typeof openApiPathToHonoPath).toBe("function");
    expect(typeof openApiPathToNextSegments).toBe("function");
    expect(typeof deriveAuthSchemes).toBe("function");
    expect(typeof deriveUseCaseArgumentExpressions).toBe("function");
    expect(typeof deriveHttpControllerBinding).toBe("function");
    expect(typeof renderHttpControllersFile).toBe("function");
    expect(typeof renderInMemoryAuthAdapterFile).toBe("function");
    expect(typeof renderSecurityMetaLiteral).toBe("function");
    expect(typeof collectApiKeyHeaderNames).toBe("function");
    expect(typeof renderApiKeyDefaultsMapLiteral).toBe("function");
  });
});
