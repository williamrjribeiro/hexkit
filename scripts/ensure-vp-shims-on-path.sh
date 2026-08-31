#!/bin/sh
# Prefer managed Vite+ shims over workspace node_modules/.bin/vp (which lacks vp node).
# setup-vp 1.18+ installs to ~/.local/share/vite-plus/bin; older installs use ~/.vite-plus/bin.
VP_BIN_DIR="${SHIM_DIR:-${INSTALL_DIR:-${VP_HOME:-$HOME/.local/share/vite-plus}}/bin}"
if [ ! -x "$VP_BIN_DIR/vp" ]; then
  VP_BIN_DIR=${VP_HOME:-$HOME/.vite-plus}/bin
fi
if [ -x "$VP_BIN_DIR/vp" ]; then
  PATH="$VP_BIN_DIR:$PATH"
  export PATH
fi
