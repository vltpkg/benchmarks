import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The app's `@/` import alias, so route handlers can be tested directly.
  // `next/cache` and `next/server` are stubs: the handlers run without Next, so nothing is
  // cached and there is no request scope (test/next-cache.ts, test/next-server.ts).
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "next/cache": fileURLToPath(new URL("./test/next-cache.ts", import.meta.url)),
      "next/server": fileURLToPath(new URL("./test/next-server.ts", import.meta.url)),
    },
  },
  // tsconfig keeps JSX for Next to compile; tests that render (app/og) need it compiled here.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
