#!/bin/sh
set -eu

# Stable output dir so `vp run dogfood:petstore:hono:down` can find Compose.
# Respects HEXKIT_KEEP_STACK and an explicit HEXKIT_DOGFOOD_OUTPUT override.
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export HEXKIT_DOGFOOD_OUTPUT=${HEXKIT_DOGFOOD_OUTPUT:-/tmp/hexkit-dogfood-petstore-hono}
exec sh "$ROOT_DIR/apps/petstore-sample/scripts/dogfood.sh" "$@"
