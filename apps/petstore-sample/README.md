# `@hexkit/petstore-sample`

Canonical dogfooding project for generating and validating a deployable
application from the Swagger Petstore OpenAPI specification.

Run dogfood through the uncached workspace task, not a package script:

```bash
vp run dogfood
```

Supported caller configuration:

- `PETSTORE_API_URL` changes the API readiness and Pactum target.
- `HEXKIT_KEEP_STACK=1` retains Compose and temporary output.
- `HEXKIT_DOGFOOD_OUTPUT` selects the generation directory.

The uncached root task preserves these caller values in the dogfood process.
Docker is required for live acceptance.
