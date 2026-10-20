import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The app's `@/` import alias, so route handlers can be tested directly.
  // `next/cache` is a stub: the handlers run without Next, so nothing is cached (test/next-cache.ts).
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "next/cache": fileURLToPath(new URL("./test/next-cache.ts", import.meta.url)),
    },
  },
  // tsconfig keeps JSX for Next to compile; tests that render (app/og) need it compiled here.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
