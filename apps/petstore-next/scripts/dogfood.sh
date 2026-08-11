#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
SAMPLE_DIR="$ROOT_DIR/apps/petstore-sample"
NEXT_DIR="$ROOT_DIR/apps/petstore-next"
NEXT_URL=${PETSTORE_NEXT_URL:-http://127.0.0.1:3000}
NEXT_PORT=${PETSTORE_NEXT_PORT:-3000}
POSTGRES_PORT=${PETSTORE_NEXT_POSTGRES_PORT:-55432}
POSTGRES_DB=${POSTGRES_DB:-hexkit_petstore_poc}
POSTGRES_USER=${POSTGRES_USER:-hexkit_petstore_poc}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-hexkit_petstore_poc}
KEEP_STACK=${HEXKIT_KEEP_STACK:-0}
SKIP_COMPOSE=${HEXKIT_SKIP_COMPOSE:-auto}
REMOVE_OUTPUT=0
COMPOSE_STARTED=0
NEXT_PID=

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
    printf 'PETSTORE_NEXT_PORT=%s\n' "$NEXT_PORT"
    printf 'PETSTORE_NEXT_POSTGRES_PORT=%s\n' "$POSTGRES_PORT"
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

COMPOSE_FILE="$OUTPUT_DIR/docker-compose.petstore-next.yml"

cleanup() {
  status=$?
  trap - EXIT INT TERM

  if [ -n "$NEXT_PID" ]; then
    kill "$NEXT_PID" 2>/dev/null || true
    wait "$NEXT_PID" 2>/dev/null || true
  fi

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

write_postgres_compose() {
  cat >"$COMPOSE_FILE" <<EOF
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: "$POSTGRES_DB"
      POSTGRES_USER: "$POSTGRES_USER"
      POSTGRES_PASSWORD: "$POSTGRES_PASSWORD"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \$\$POSTGRES_USER -d \$\$POSTGRES_DB"]
      interval: 2s
      timeout: 5s
      retries: 15
    ports:
      - "127.0.0.1:$POSTGRES_PORT:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
EOF
}

copy_generated_routes() {
  find "$NEXT_DIR/app" -type f -name route.ts -exec rm -f {} +

  find "$OUTPUT_DIR/app" -type f -name route.ts | while IFS= read -r route_file; do
    relative_path=${route_file#"$OUTPUT_DIR/app/"}
    destination="$NEXT_DIR/app/$relative_path"
    mkdir -p "$(dirname -- "$destination")"
    cp "$route_file" "$destination"
  done
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
  --http next --next-surface routes

rm -rf "$NEXT_DIR/src"
mkdir -p "$NEXT_DIR/src"
cp -R "$OUTPUT_DIR/src/." "$NEXT_DIR/src/"
copy_generated_routes

vp install

(
  cd "$NEXT_DIR"
  vp run build
)

if [ "$SKIP_COMPOSE" = "1" ]; then
  printf 'HEXKIT_SKIP_COMPOSE=1; skipping optional Postgres and next start smoke after successful build.\n'
  exit 0
fi

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  if [ "$SKIP_COMPOSE" = "0" ]; then
    printf 'Error: Docker is required because HEXKIT_SKIP_COMPOSE=0.\n' >&2
    exit 127
  fi

  printf 'Docker is unavailable; skipping optional Postgres and next start smoke after successful build.\n'
  exit 0
fi

schema_file=$(find "$OUTPUT_DIR/drizzle" -type f -name '*.sql' | sort | sed -n '1p')
if [ -z "$schema_file" ]; then
  printf 'Error: generated Drizzle schema was not found in %s.\n' "$OUTPUT_DIR/drizzle" >&2
  exit 1
fi

write_postgres_compose
COMPOSE_STARTED=1
docker compose -f "$COMPOSE_FILE" up -d --wait postgres
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <"$schema_file"

DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:$POSTGRES_PORT/$POSTGRES_DB"
export DATABASE_URL

(
  cd "$NEXT_DIR"
  HOSTNAME=127.0.0.1 PORT="$NEXT_PORT" vp run start
) &
NEXT_PID=$!

wait_for_url "$NEXT_URL/" 200 "PetShop home page"
wait_for_url "$NEXT_URL/pets" 200 "PetShop pets page"
smoke_pet_route

printf 'PetShop Next dogfood completed successfully at %s.\n' "$NEXT_URL"
