#!/usr/bin/env sh
# Wire Vite+ commit hooks when Cursor (or another tool) owns core.hooksPath.
#
# vp config refuses to set core.hooksPath if it is already taken. Cursor Cloud
# agents set hooksPath to an agent-hooks dispatcher that is supposed to chain to
# the previous hooks directory via .cursor-original-hooks-path — but that file
# usually still points at the empty default (.git/hooks), so .vite-hooks/pre-commit
# (vp staged → vp check --fix) never runs and formatting slips into CI.
#
# This script:
# 1. Ensures the generated Vite+ dispatcher under .vite-hooks/_ exists
# 2. Points Cursor's original-hooks-path at that dispatcher
# 3. Installs a .git/hooks/pre-commit bridge as a fallback if Cursor resets the
#    original path back to .git/hooks
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DISPATCHER="$ROOT/.vite-hooks/_"
PROJECT_HOOK="$ROOT/.vite-hooks/pre-commit"

if [ ! -f "$PROJECT_HOOK" ]; then
  echo "ensure-commit-hooks: missing $PROJECT_HOOK (nothing to wire)" >&2
  exit 0
fi

ensure_dispatcher() {
  if [ -x "$DISPATCHER/pre-commit" ] && [ -x "$DISPATCHER/h" ]; then
    return 0
  fi

  echo "ensure-commit-hooks: regenerating .vite-hooks/_ (vp config previously skipped)"
  prev="$(git -C "$ROOT" config --get core.hooksPath || true)"
  if [ -n "$prev" ]; then
    git -C "$ROOT" config --unset-all core.hooksPath || true
  fi
  (cd "$ROOT" && vp config --no-agent)
  if [ -n "$prev" ]; then
    git -C "$ROOT" config core.hooksPath "$prev"
  fi

  if [ ! -x "$DISPATCHER/pre-commit" ]; then
    echo "ensure-commit-hooks: failed to create $DISPATCHER/pre-commit" >&2
    exit 1
  fi
}

install_git_hooks_bridge() {
  git_hooks="$ROOT/.git/hooks"
  mkdir -p "$git_hooks"
  bridge="$git_hooks/pre-commit"
  cat >"$bridge" <<'EOF'
#!/usr/bin/env sh
# hexkit bridge: run Vite+ staged checks (vp staged → vp check --fix)
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
HOOK="$ROOT/.vite-hooks/_/pre-commit"
if [ -x "$HOOK" ]; then
  exec "$HOOK" "$@"
fi
exit 0
EOF
  chmod +x "$bridge"
}

HOOKS_PATH="$(git -C "$ROOT" config --get core.hooksPath || true)"

# No custom hooksPath: vp config owns enablement; nothing to bridge.
if [ -z "$HOOKS_PATH" ]; then
  ensure_dispatcher
  exit 0
fi

case "$HOOKS_PATH" in
  /*) cursor_dir="$HOOKS_PATH" ;;
  *) cursor_dir="$ROOT/$HOOKS_PATH" ;;
esac

ensure_dispatcher
install_git_hooks_bridge

orig_file="$cursor_dir/.cursor-original-hooks-path"
if [ -f "$orig_file" ] || [ -d "$cursor_dir" ]; then
  printf '%s\n' "$DISPATCHER" >"$orig_file"
  echo "ensure-commit-hooks: Cursor chain $orig_file -> $DISPATCHER"
else
  echo "ensure-commit-hooks: installed .git/hooks/pre-commit bridge -> $DISPATCHER"
fi
