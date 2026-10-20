#!/usr/bin/env node
/**
 * Serve the results tree locally.
 *
 * Usage:
 *   node bin/serve.mts --root <dir> [--port <n>]
 *
 * `--root` is REQUIRED and has no default. Serving a directory that does not
 * exist answers 404 to everything while the process reports itself healthy --
 * the same silent-empty-success this repository keeps producing. Refusing to
 * guess turns that into an immediate, readable failure.
 */
import { statSync } from "node:fs";
import { createDataServer } from "../src/serve.ts";

const argv = process.argv.slice(2);
let root: string | undefined;
let port = 8811;

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--root") {
    root = argv[i + 1] ?? root;
    i++;
  } else if (arg === "--port") {
    port = Number(argv[i + 1] ?? port);
    i++;
  } else if (arg === "--watch") {
    // Accepted so `dev` and `start` can share this entrypoint. The tree is
    // read per request, so there is nothing to rebuild on change.
  }
}

if (root === undefined) {
  console.error(
    "--root <dir> is required.\n" +
      "Refusing to guess a directory to serve: a wrong guess answers 404 to\n" +
      "every request while looking healthy.\n" +
      "  node bin/serve.mts --root suite/results",
  );
  process.exit(2);
}

// Requiring the argument is not enough. suite/results/ is gitignored and
// absent in a fresh checkout, so the common failure is a root that is supplied
// and spelled correctly but does not exist yet -- which serves 404 to
// everything while reporting itself healthy. Same trap, one step later.
let rootIsDir = false;
try {
  rootIsDir = statSync(root).isDirectory();
} catch {
  rootIsDir = false;
}
if (!rootIsDir) {
  console.error(
    `--root ${root} is not a directory.\n` +
      "Refusing to serve it: an absent root answers 404 to every request while\n" +
      "the process looks healthy. suite/results/ is gitignored and absent in a\n" +
      "fresh checkout -- generate it first:\n" +
      "  ./suite/bench process            # from measured results\n" +
      "  vlt run --workspace=apps/data build",
  );
  process.exit(2);
}

createDataServer({ root, port }).listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port}`);
});
