#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
SAMPLE_DIR="$ROOT_DIR/apps/petstore-sample"
API_BASE_URL=${PETSTORE_API_URL:-http://127.0.0.1:3000}
KEEP_STACK=${HEXKIT_KEEP_STACK:-0}
REMOVE_OUTPUT=0
COMPOSE_STARTED=0

if [ -n "${HEXKIT_DOGFOOD_OUTPUT:-}" ]; then
  OUTPUT_DIR=$HEXKIT_DOGFOOD_OUTPUT
  mkdir -p "$OUTPUT_DIR"
else
  OUTPUT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/hexkit-dogfood.XXXXXX")
  REMOVE_OUTPUT=1
fi

cleanup() {
  status=$?
  trap - EXIT

  if [ "$COMPOSE_STARTED" -eq 1 ]; then
    if [ "$KEEP_STACK" = "1" ]; then
      printf 'Retaining dogfood Compose stack in %s\n' "$OUTPUT_DIR"
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

vp run @hexkit/petstore-sample#test:generation
vp run @hexkit/cli#build
vp node apps/cli/dist/index.mjs generate "$SAMPLE_DIR/openapi.poc.yaml" "$OUTPUT_DIR"

(
  cd "$OUTPUT_DIR"
  vp install --no-frozen-lockfile
  vp run check
)

if ! command -v docker >/dev/null 2>&1; then
  printf 'Error: Docker is required to run the generated Petstore acceptance stack.\n' >&2
  exit 127
fi

COMPOSE_STARTED=1
docker compose -f "$OUTPUT_DIR/docker-compose.yml" up --build -d --wait

attempt=1
while ! PETSTORE_API_URL="$API_BASE_URL" vp node -e '
const baseUrl = process.env.PETSTORE_API_URL;
fetch(`${baseUrl}/pet/2147483647`)
  .then((response) => process.exit(response.status === 404 ? 0 : 1))
  .catch(() => process.exit(1));
'; do
  if [ "$attempt" -ge 30 ]; then
    printf 'Error: generated Petstore did not become ready at %s.\n' "$API_BASE_URL" >&2
    docker compose -f "$OUTPUT_DIR/docker-compose.yml" logs
    exit 1
  fi

  attempt=$((attempt + 1))
  sleep 1
done

PETSTORE_API_URL="$API_BASE_URL" vp run @hexkit/petstore-sample#test:api
