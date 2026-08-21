#!/usr/bin/env bash
# Run Vitest coverage for Hexkit generator packages only.
# Dogfood apps are intentionally excluded (no coverage script / not listed here).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
status=0

for dir in "$root"/packages/* "$root"/apps/cli; do
  if [[ ! -f "$dir/package.json" ]]; then
    continue
  fi
  cmd="$(jq -r '.scripts.coverage // empty' "$dir/package.json")"
  if [[ -z "$cmd" ]]; then
    continue
  fi
  name="$(jq -r '.name' "$dir/package.json")"
  echo "=== coverage: $name ($dir) ==="
  # Invoke the package coverage command directly (avoid nested `vp run`).
  if ! (cd "$dir" && eval "$cmd"); then
    status=1
  fi
done

exit "$status"
