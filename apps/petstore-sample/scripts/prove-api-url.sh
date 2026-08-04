#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
CUSTOM_URL=${PETSTORE_API_URL_PROOF_VALUE:-http://127.0.0.1:1}
CUSTOM_OUTPUT=${HEXKIT_DOGFOOD_OUTPUT_PROOF_VALUE:-/tmp/hexkit-dogfood-config-proof}
SECOND_URL="${CUSTOM_URL%/}/second-run"
SECOND_OUTPUT="${CUSTOM_OUTPUT%/}-second-run"

run_task() {
  (
    cd "$ROOT_DIR"
    PETSTORE_API_URL="$1" \
    HEXKIT_KEEP_STACK=1 \
    HEXKIT_DOGFOOD_OUTPUT="$2" \
      vp run dogfood --print-config
  )
}

first_output=$(run_task "$CUSTOM_URL" "$CUSTOM_OUTPUT")
second_output=$(run_task "$SECOND_URL" "$SECOND_OUTPUT")

case "$first_output" in
  *"PETSTORE_API_URL=$CUSTOM_URL"*"HEXKIT_KEEP_STACK=1"*"HEXKIT_DOGFOOD_OUTPUT=$CUSTOM_OUTPUT"*)
    ;;
  *)
    printf '%s\n' "$first_output" >&2
    printf 'Error: root dogfood task did not receive its configured environment.\n' >&2
    exit 1
    ;;
esac

case "$second_output" in
  *"PETSTORE_API_URL=$SECOND_URL"*"HEXKIT_KEEP_STACK=1"*"HEXKIT_DOGFOOD_OUTPUT=$SECOND_OUTPUT"*)
    ;;
  *)
    printf '%s\n' "$second_output" >&2
    printf 'Error: root dogfood task replayed or lost its second configured environment.\n' >&2
    exit 1
    ;;
esac

printf 'Root dogfood task received two uncached configured environments: %s, %s\n' \
  "$CUSTOM_URL" "$SECOND_URL"
