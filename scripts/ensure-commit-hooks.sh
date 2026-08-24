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
#
# Never fail prepare: a missing dispatcher or a failed vp config leaves Cursor
# hooks in place and prints a warning. Intentionally disabled hooks
# (empty core.hooksPath, e.g. after `vp hooks disable`) are left alone.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DISPATCHER="$ROOT/.vite-hooks/_"
PROJECT_HOOK="$ROOT/.vite-hooks/pre-commit"
_ENSURE_PREV=""

if [ ! -f "$PROJECT_HOOK" ]; then
  echo "ensure-commit-hooks: missing $PROJECT_HOOK (nothing to wire)" >&2
  exit 0
fi

restore_hooks_path() {
  if [ -n "${_ENSURE_PREV-}" ]; then
    git -C "$ROOT" config core.hooksPath "$_ENSURE_PREV" || true
    _ENSURE_PREV=""
  fi
}

ensure_dispatcher() {
  if [ -x "$DISPATCHER/pre-commit" ] && [ -x "$DISPATCHER/h" ]; then
    return 0
  fi

  echo "ensure-commit-hooks: regenerating .vite-hooks/_ (vp config previously skipped)"
  _ENSURE_PREV="$(git -C "$ROOT" config --get core.hooksPath || true)"
  trap restore_hooks_path EXIT INT HUP TERM
  if [ -n "$_ENSURE_PREV" ]; then
    git -C "$ROOT" config --unset-all core.hooksPath || true
  fi
  status=0
  (cd "$ROOT" && vp config --no-agent) || status=$?
  restore_hooks_path
  trap - EXIT INT HUP TERM

  if [ "$status" -ne 0 ]; then
    echo "ensure-commit-hooks: vp config --no-agent failed (code $status); left core.hooksPath unchanged" >&2
    return 0
  fi

  if [ ! -x "$DISPATCHER/pre-commit" ]; then
    echo "ensure-commit-hooks: dispatcher still missing at $DISPATCHER/pre-commit; skipping chain" >&2
    return 0
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

# No custom hooksPath: vp config already ran in prepare and owns enablement.
# Do not regenerate or fail — that would break `vp hooks disable` clones.
if [ -z "$HOOKS_PATH" ]; then
  echo "ensure-commit-hooks: core.hooksPath unset; nothing to bridge"
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
