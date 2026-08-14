import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

const overlayScript = new URL("../../petstore-next/scripts/overlay-fixture.sh", import.meta.url)
  .pathname;

describe("Given a generated Next tree and PetShop fixture", () => {
  it("when overlaid, then fixture UI replaces stubs and generated route.ts stays", () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-overlay-"));
    const generated = join(root, "generated");
    const fixture = join(root, "fixture");

    mkdirSync(join(generated, "app/pet"), { recursive: true });
    writeFileSync(
      join(generated, "app/page.tsx"),
      "export default function Page() { return <p>API only</p>; }\n",
    );
    writeFileSync(
      join(generated, "app/layout.tsx"),
      "export default function L({ children }) { return children; }\n",
    );
    writeFileSync(join(generated, "app/pet/route.ts"), "export async function POST() {}\n");
    writeFileSync(
      join(generated, "package.json"),
      JSON.stringify({ name: "generated", devDependencies: { typescript: "7.0.2" } }),
    );

    mkdirSync(join(fixture, "app/pets"), { recursive: true });
    mkdirSync(join(fixture, "app/orders"), { recursive: true });
    writeFileSync(
      join(fixture, "app/page.tsx"),
      "export default function Page() { return <h1>Shop</h1>; }\n",
    );
    writeFileSync(
      join(fixture, "app/layout.tsx"),
      "export default function L({ children }) { return children; }\n",
    );
    writeFileSync(join(fixture, "app/globals.css"), '@import "tailwindcss";\n');
    writeFileSync(
      join(fixture, "app/pets/page.tsx"),
      "export default function Pets() { return <h1>Pets</h1>; }\n",
    );
    writeFileSync(
      join(fixture, "app/orders/page.tsx"),
      "export default function Orders() { return <h1>Orders</h1>; }\n",
    );
    writeFileSync(
      join(fixture, "postcss.config.mjs"),
      "export default { plugins: { '@tailwindcss/postcss': {} } };\n",
    );
    writeFileSync(
      join(fixture, "package.json"),
      JSON.stringify({
        devDependencies: { tailwindcss: "^4", "@tailwindcss/postcss": "^4" },
      }),
    );

    execFileSync("sh", [overlayScript, generated, fixture], { stdio: "pipe" });

    expect(readFileSync(join(generated, "app/page.tsx"), "utf8")).toContain("Shop");
    expect(readFileSync(join(generated, "app/pets/page.tsx"), "utf8")).toContain("Pets");
    expect(readFileSync(join(generated, "app/pet/route.ts"), "utf8")).toContain("POST");
    expect(readFileSync(join(generated, "postcss.config.mjs"), "utf8")).toContain(
      "tailwindcss/postcss",
    );
    const manifest = JSON.parse(readFileSync(join(generated, "package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(manifest.devDependencies.tailwindcss).toBe("^4");
    expect(manifest.devDependencies["@tailwindcss/postcss"]).toBe("^4");
    expect(manifest.devDependencies.typescript).toBe("7.0.2");
  });
});
