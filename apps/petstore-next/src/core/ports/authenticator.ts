import type { Principal } from "../domain/auth-principal.ts";

export type AuthCredentials =
  | { kind: "bearer"; schemeName: string; token: string }
  | { kind: "apiKey"; schemeName: string; headerName: string; apiKey: string };

export type Authenticator = {
  authenticate(credentials: AuthCredentials): Promise<Principal | null>;
};
