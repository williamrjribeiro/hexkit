#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
FIXTURE_DIR="$ROOT_DIR/apps/fixtures/auth-api"
API_BASE_URL=${AUTH_API_URL:-http://127.0.0.1:3000}
KEEP_STACK=${HEXKIT_KEEP_STACK:-0}
REMOVE_OUTPUT=0
COMPOSE_STARTED=0

# `vp run` prepends workspace node_modules/.bin, whose local `vp` lacks managed
# runtime commands like `vp node`. Prefer the global Vite+ CLI when present.
. "$ROOT_DIR/scripts/ensure-vp-shims-on-path.sh"

case "${1:-}" in
  --print-config)
    printf 'AUTH_API_URL=%s\n' "$API_BASE_URL"
    printf 'HEXKIT_KEEP_STACK=%s\n' "$KEEP_STACK"
    printf 'HEXKIT_DOGFOOD_OUTPUT=%s\n' "${HEXKIT_DOGFOOD_OUTPUT:-}"
    exit 0
    ;;
  "")
    ;;
  *)
    printf 'Error: unknown dogfood argument: %s\n' "$1" >&2
    exit 2
    ;;
esac

if [ -n "${HEXKIT_DOGFOOD_OUTPUT:-}" ]; then
  OUTPUT_DIR=$HEXKIT_DOGFOOD_OUTPUT
  mkdir -p "$OUTPUT_DIR"
else
  OUTPUT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/hexkit-auth-dogfood.XXXXXX")
  REMOVE_OUTPUT=1
fi

cleanup() {
  status=$?
  trap - EXIT

  if [ "$COMPOSE_STARTED" -eq 1 ]; then
    if [ "$KEEP_STACK" = "1" ]; then
      printf 'Retaining auth dogfood Compose stack in %s\n' "$OUTPUT_DIR"
    else
      docker compose -f "$OUTPUT_DIR/docker-compose.yml" down --volumes || true
    fi
  fi

  if [ "$REMOVE_OUTPUT" -eq 1 ] && [ "$KEEP_STACK" != "1" ]; then
    rm -rf "$OUTPUT_DIR"
  fi

  exit "$status"
}
trap cleanup EXIT

cd "$ROOT_DIR"

vp run -r build
vp node apps/cli/dist/index.mjs generate "$FIXTURE_DIR/openapi.yaml" "$OUTPUT_DIR"

(
  cd "$OUTPUT_DIR"
  vp install --no-frozen-lockfile
  vp run check
)

if ! command -v docker >/dev/null 2>&1; then
  printf 'Error: Docker is required to run the generated Auth API acceptance stack.\n' >&2
  exit 127
fi

COMPOSE_STARTED=1
docker compose -f "$OUTPUT_DIR/docker-compose.yml" up --build -d --wait

attempt=1
while ! AUTH_API_URL="$API_BASE_URL" vp node -e '
const baseUrl = process.env.AUTH_API_URL;
fetch(`${baseUrl}/health`)
  .then((response) => process.exit(response.status === 200 ? 0 : 1))
  .catch(() => process.exit(1));
'; do
  if [ "$attempt" -ge 30 ]; then
    printf 'Error: generated Auth API did not become ready at %s.\n' "$API_BASE_URL" >&2
    docker compose -f "$OUTPUT_DIR/docker-compose.yml" logs
    exit 1
  fi

  attempt=$((attempt + 1))
  sleep 1
done

(
  cd "$FIXTURE_DIR"
  AUTH_API_URL="$API_BASE_URL" vp test run tests/api.test.ts
)
