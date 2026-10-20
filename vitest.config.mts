import { defineConfig } from "vitest/config";

// Workspace members own their own test setup; this root config only aggregates
// them so `vlt run test` at the root covers the whole monorepo. The globs match
// vlt.json's `workspaces` groups. The benchmark suite's own tests under
// scripts/ are deliberately out of scope here -- the suite is frozen.
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
  },
});
