#!/bin/sh
set -eu

GENERATED_DIR=${1:-}
FIXTURE_DIR=${2:-}

if [ -z "$GENERATED_DIR" ] || [ -z "$FIXTURE_DIR" ]; then
  printf 'Usage: overlay-fixture.sh GENERATED_DIR FIXTURE_DIR\n' >&2
  exit 2
fi

VP_BIN_DIR=${VP_HOME:-$HOME/.vite-plus}/bin
if [ -x "$VP_BIN_DIR/vp" ]; then
  PATH="$VP_BIN_DIR:$PATH"
  export PATH
fi

mkdir -p "$GENERATED_DIR/app"

cp "$FIXTURE_DIR/app/layout.tsx" "$GENERATED_DIR/app/layout.tsx"
cp "$FIXTURE_DIR/app/page.tsx" "$GENERATED_DIR/app/page.tsx"
cp "$FIXTURE_DIR/app/globals.css" "$GENERATED_DIR/app/globals.css"
cp "$FIXTURE_DIR/postcss.config.mjs" "$GENERATED_DIR/postcss.config.mjs"

rm -rf "$GENERATED_DIR/app/pets" "$GENERATED_DIR/app/orders"
cp -R "$FIXTURE_DIR/app/pets" "$GENERATED_DIR/app/pets"
cp -R "$FIXTURE_DIR/app/orders" "$GENERATED_DIR/app/orders"

GENERATED_PACKAGE_JSON="$GENERATED_DIR/package.json" \
  FIXTURE_PACKAGE_JSON="$FIXTURE_DIR/package.json" \
  vp node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";

const generatedPath = process.env.GENERATED_PACKAGE_JSON;
const fixturePath = process.env.FIXTURE_PACKAGE_JSON;
if (!generatedPath || !fixturePath) {
  throw new Error("GENERATED_PACKAGE_JSON and FIXTURE_PACKAGE_JSON are required.");
}

const generated = JSON.parse(readFileSync(generatedPath, "utf8"));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const keys = ["tailwindcss", "@tailwindcss/postcss"];

generated.devDependencies ??= {};
for (const key of keys) {
  const value = fixture.devDependencies?.[key];
  if (typeof value === "string") generated.devDependencies[key] = value;
}

writeFileSync(generatedPath, `${JSON.stringify(generated, null, 2)}\n`);
'
