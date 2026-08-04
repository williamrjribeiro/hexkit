#!/bin/sh
set -eu

SAMPLE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CUSTOM_URL=${PETSTORE_API_URL_PROOF_VALUE:-http://127.0.0.1:1}

cd "$SAMPLE_DIR"

set +e
output=$(
  PETSTORE_API_URL="$CUSTOM_URL" \
    vp test run tests/api.test.ts \
    -t "when a Pet is added" \
    --reporter=verbose 2>&1
)
status=$?
set -e

if [ "$status" -eq 0 ]; then
  printf 'Error: custom URL proof expected the unavailable endpoint to fail.\n' >&2
  exit 1
fi

case "$output" in
  *"Petstore acceptance request failed against $CUSTOM_URL."*"ECONNREFUSED"*)
    printf 'Custom PETSTORE_API_URL reached the API test process: %s\n' "$CUSTOM_URL"
    ;;
  *)
    printf '%s\n' "$output" >&2
    printf 'Error: API test failure did not contain the configured URL and connection refusal.\n' >&2
    exit 1
    ;;
esac
