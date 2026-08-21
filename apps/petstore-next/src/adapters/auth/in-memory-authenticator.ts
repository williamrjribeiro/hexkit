import type { Authenticator } from "../../core/ports/authenticator.ts";

export function createInMemoryAuthenticator(options: {
  bearerTokens?: ReadonlySet<string>;
  apiKeys?: ReadonlyMap<string, ReadonlySet<string>>;
}): Authenticator {
  return {
    async authenticate(credentials) {
      if (credentials.kind === "bearer") {
        if (!options.bearerTokens?.has(credentials.token)) return null;
        return { id: "bearer-user", scheme: credentials.schemeName, scopes: [] };
      }

      const allowed = options.apiKeys?.get(credentials.headerName.toLowerCase());
      if (!allowed?.has(credentials.apiKey)) return null;
      return { id: "api-key-user", scheme: credentials.schemeName, scopes: [] };
    },
  };
}
