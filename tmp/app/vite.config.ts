import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/",
  // Pinned so the build target does not depend on cwd. `outDir` resolves
  // against vite's `root`, which defaults to process.cwd() -- the old
  // "../results/" only reached the repo root because CI ran the build from
  // inside the app directory.
  // From tmp/app/ that would now be tmp/results/.
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // suite/results/ -- the single results tree, and what publish_dir points
    // at. CI no longer builds this app at all; a local build here is how the
    // published bundle gets refreshed, so it has to land in the tree that
    // gets deployed. Pointing at the old repo-root results/ would recreate
    // the second tree this mission removed.
    //
    // Deliberately OUTSIDE vite's root: vite declines to empty an outDir it
    // does not own, which is the only reason this build does not wipe the
    // benchmark data it lands next to.
    outDir: path.resolve(__dirname, "../../suite/results"),
  },
});
