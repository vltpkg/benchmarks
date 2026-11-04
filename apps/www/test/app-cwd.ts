/*
 * The app reads its own files from `process.cwd()` (lib/mdx.ts, lib/opengraph), which is how Next
 * runs it: from apps/www, with server code bundled into .next where `import.meta.url` would not
 * point at src/. The root `vlt run test` starts vitest at the repo root, so put the tests there too.
 */
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
