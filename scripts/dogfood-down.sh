#!/bin/sh
set -eu

OUTPUT_DIR=${1:-}
LABEL=${2:-dogfood}

if [ -z "$OUTPUT_DIR" ]; then
  printf 'Usage: dogfood-down.sh OUTPUT_DIR [LABEL]\n' >&2
  exit 2
fi

COMPOSE_FILE="$OUTPUT_DIR/docker-compose.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  printf 'Error: no Compose file at %s.\n' "$COMPOSE_FILE" >&2
  printf 'Run the matching dogfood:petstore:* task with HEXKIT_KEEP_STACK=1 first,\n' >&2
  printf 'or pass HEXKIT_DOGFOOD_OUTPUT=%s when starting.\n' "$OUTPUT_DIR" >&2
  exit 1
fi

printf 'Stopping %s Compose stack in %s\n' "$LABEL" "$OUTPUT_DIR"
docker compose -f "$COMPOSE_FILE" down --volumes
printf 'Stopped %s Compose stack.\n' "$LABEL"
