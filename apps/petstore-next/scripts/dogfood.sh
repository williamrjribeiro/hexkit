#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
SAMPLE_DIR="$ROOT_DIR/apps/petstore-sample"
NEXT_DIR="$ROOT_DIR/apps/petstore-next"
OVERLAY_SCRIPT="$NEXT_DIR/scripts/overlay-fixture.sh"
NEXT_URL=${PETSTORE_NEXT_URL:-http://127.0.0.1:3000}
KEEP_STACK=${HEXKIT_KEEP_STACK:-0}
SKIP_COMPOSE=${HEXKIT_SKIP_COMPOSE:-auto}
REMOVE_OUTPUT=0
COMPOSE_STARTED=0

# `vp run` prepends workspace node_modules/.bin, whose local `vp` lacks managed
# runtime commands like `vp node`. Prefer the global Vite+ CLI when present.
VP_BIN_DIR=${VP_HOME:-$HOME/.vite-plus}/bin
if [ -x "$VP_BIN_DIR/vp" ]; then
  PATH="$VP_BIN_DIR:$PATH"
  export PATH
fi

case "${1:-}" in
  --print-config)
    printf 'PETSTORE_NEXT_URL=%s\n' "$NEXT_URL"
    printf 'HEXKIT_KEEP_STACK=%s\n' "$KEEP_STACK"
    printf 'HEXKIT_SKIP_COMPOSE=%s\n' "$SKIP_COMPOSE"
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
  OUTPUT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/hexkit-petstore-next-dogfood.XXXXXX")
  REMOVE_OUTPUT=1
fi

COMPOSE_FILE="$OUTPUT_DIR/docker-compose.yml"

cleanup() {
  status=$?
  trap - EXIT INT TERM

  if [ "$COMPOSE_STARTED" -eq 1 ]; then
    if [ "$KEEP_STACK" = "1" ]; then
      printf 'Retaining PetShop dogfood Compose stack in %s\n' "$OUTPUT_DIR"
    else
      docker compose -f "$COMPOSE_FILE" down --volumes || true
    fi
  fi

  if [ "$REMOVE_OUTPUT" -eq 1 ] && [ "$KEEP_STACK" != "1" ]; then
    rm -rf "$OUTPUT_DIR"
  fi

  exit "$status"
}
trap cleanup EXIT INT TERM

copy_generated_routes() {
  find "$NEXT_DIR/app" -type f -name route.ts -exec rm -f {} +

  find "$OUTPUT_DIR/app" -type f -name route.ts | while IFS= read -r route_file; do
    relative_path=${route_file#"$OUTPUT_DIR/app/"}
    destination="$NEXT_DIR/app/$relative_path"
    mkdir -p "$(dirname -- "$destination")"
    cp "$route_file" "$destination"
  done
}

lint_next_app() {
  app_dir=$1
  label=$2

  printf 'Running eslint-config-next on %s\n' "$label"

  if [ ! -f "$NEXT_DIR/node_modules/eslint/bin/eslint.js" ]; then
    printf 'Error: eslint is not installed in %s. Run vp install from the repo root.\n' "$NEXT_DIR" >&2
    exit 1
  fi

  if [ ! -f "$app_dir/eslint.config.mjs" ]; then
    cp "$NEXT_DIR/eslint.config.mjs" "$app_dir/eslint.config.mjs"
  fi

  modules_link=$app_dir/node_modules
  created_modules_link=0
  if [ ! -e "$modules_link" ]; then
    ln -s "$NEXT_DIR/node_modules" "$modules_link"
    created_modules_link=1
  fi

  lint_status=0
  (
    cd "$app_dir"
    vp node "$NEXT_DIR/node_modules/eslint/bin/eslint.js" . --max-warnings 0 --no-cache
  ) || lint_status=$?

  if [ "$created_modules_link" -eq 1 ]; then
    rm "$modules_link"
  fi

  if [ "$lint_status" -ne 0 ]; then
    printf 'Error: eslint-config-next failed for %s.\n' "$label" >&2
    exit "$lint_status"
  fi

  printf 'eslint-config-next passed for %s\n' "$label"
}

wait_for_url() {
  url=$1
  expected_status=$2
  label=$3
  attempt=1

  while ! DOGFOOD_URL="$url" DOGFOOD_EXPECTED_STATUS="$expected_status" vp node -e '
const url = process.env.DOGFOOD_URL;
const expectedStatus = Number(process.env.DOGFOOD_EXPECTED_STATUS);
fetch(url)
  .then((response) => process.exit(response.status === expectedStatus ? 0 : 1))
  .catch(() => process.exit(1));
'; do
    if [ "$attempt" -ge 30 ]; then
      printf 'Error: %s did not return HTTP %s at %s.\n' "$label" "$expected_status" "$url" >&2
      docker compose -f "$COMPOSE_FILE" logs
      exit 1
    fi

    attempt=$((attempt + 1))
    sleep 1
  done
}

smoke_pet_route() {
  DOGFOOD_URL="$NEXT_URL/pet" vp node -e '
const url = process.env.DOGFOOD_URL;
fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: 2147483646, name: "Dogfood", status: "available" }),
})
  .then((response) => process.exit(response.ok ? 0 : 1))
  .catch(() => process.exit(1));
'
}

cd "$ROOT_DIR"

vp run -F @hexkit/cli... build
vp node apps/cli/dist/index.mjs generate "$SAMPLE_DIR/openapi.poc.yaml" "$OUTPUT_DIR" \
  --http next --next-surface both

lint_next_app "$OUTPUT_DIR" "generated Next.js app"

sh "$OVERLAY_SCRIPT" "$OUTPUT_DIR" "$NEXT_DIR"

rm -rf "$NEXT_DIR/src"
mkdir -p "$NEXT_DIR/src"
cp -R "$OUTPUT_DIR/src/." "$NEXT_DIR/src/"
copy_generated_routes

vp install

lint_next_app "$NEXT_DIR" "PetShop Next.js fixture"

(
  cd "$NEXT_DIR"
  vp run build
)

if [ "$SKIP_COMPOSE" = "1" ]; then
  printf 'HEXKIT_SKIP_COMPOSE=1; skipping Docker Compose Next+Postgres stack after successful build.\n'
  exit 0
fi

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  if [ "$SKIP_COMPOSE" = "0" ]; then
    printf 'Error: Docker is required because HEXKIT_SKIP_COMPOSE=0.\n' >&2
    exit 127
  fi

  printf 'Docker is unavailable; skipping Docker Compose Next+Postgres stack after successful build.\n'
  exit 0
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  printf 'Error: generated Compose file was not found at %s.\n' "$COMPOSE_FILE" >&2
  exit 1
fi

COMPOSE_STARTED=1
docker compose -f "$COMPOSE_FILE" up --build -d --wait

wait_for_url "$NEXT_URL/" 200 "PetShop home page"
wait_for_url "$NEXT_URL/pets" 200 "PetShop pets page"
smoke_pet_route

printf 'PetShop Next dogfood completed successfully at %s.\n' "$NEXT_URL"
