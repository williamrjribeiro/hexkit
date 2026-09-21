#!/bin/sh
set -eu

# Stable output dir so `vp run dogfood:petstore:nextjs:down` can find Compose.
# Respects HEXKIT_KEEP_STACK, HEXKIT_SKIP_COMPOSE, and an explicit
# HEXKIT_DOGFOOD_OUTPUT override.
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export HEXKIT_DOGFOOD_OUTPUT=${HEXKIT_DOGFOOD_OUTPUT:-/tmp/hexkit-dogfood-petstore-next}
exec sh "$ROOT_DIR/apps/petstore-next/scripts/dogfood.sh" "$@"
