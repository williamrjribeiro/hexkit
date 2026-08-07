# `@hexkit/auth-api-fixture`

Auth-focused Hexkit dogfood fixture. Owns an OpenAPI contract with public,
bearer, and API-key operations, plus Pactum acceptance tests against a generated
Compose stack.

Uses the generated in-memory authenticator stub (`AUTH_BEARER_TOKENS` /
`AUTH_API_KEYS`, defaults `test-token` / `test-key`). No real authentication.

## Run dogfood (from the workspace root)

```bash
vp run dogfood-auth
```

Or run the script directly:

```bash
apps/fixtures/auth-api/scripts/dogfood.sh
```

Environment:

| Variable                | Default                 | Role                                  |
| ----------------------- | ----------------------- | ------------------------------------- |
| `AUTH_API_URL`          | `http://127.0.0.1:3000` | Base URL for readiness + Pactum       |
| `HEXKIT_DOGFOOD_OUTPUT` | temp dir                | Where generation writes the app       |
| `HEXKIT_KEEP_STACK`     | `0`                     | Keep Compose + output when set to `1` |
