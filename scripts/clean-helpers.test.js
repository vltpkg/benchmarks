const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

for (const scenario of [
  {
    name: "configured store with spaces",
    command: "clean_aube_cache",
    store: true,
  },
  { name: "unavailable store path", command: "clean_aube_cache", store: false },
  {
    name: "metadata-only cleanup",
    command: "clean_aube_metadata_cache",
    store: true,
  },
]) {
  test(`aube cache cleanup: ${scenario.name}`, (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aube-clean-test-"));
    t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
    const binDir = path.join(tempDir, "bin");
    const store = path.join(tempDir, "custom store", "v1");
    const cache = path.join(tempDir, "xdg cache");
    const removeLog = path.join(tempDir, "removed.txt");
    const commandLog = path.join(tempDir, "commands.txt");
    fs.mkdirSync(binDir);
    fs.writeFileSync(removeLog, "");
    fs.writeFileSync(
      path.join(binDir, "aube"),
      `#!/bin/sh
printf '%s\\n' "$*" >> "$COMMAND_LOG"
if [ "$1" = store ]; then
  [ "$STORE_AVAILABLE" = 1 ] || exit 1
  printf '%s\\n' "$TEST_STORE"
fi
`,
      { mode: 0o755 },
    );

    // Record deletion targets so the test never touches the user's caches.
    const result = spawnSync(
      "bash",
      [
        "-c",
        `
source "$HELPERS" >/dev/null
safe_remove() { printf '%s\\n' "$1" >> "$REMOVE_LOG"; }
"$CLEAN_COMMAND"
`,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
          HELPERS: path.join(__dirname, "clean-helpers.sh"),
          TEST_STORE: store,
          STORE_AVAILABLE: scenario.store ? "1" : "0",
          XDG_CACHE_HOME: cache,
          REMOVE_LOG: removeLog,
          COMMAND_LOG: commandLog,
          CLEAN_COMMAND: scenario.command,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const removed = fs
      .readFileSync(removeLog, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);
    const commands = fs.readFileSync(commandLog, "utf8").trim().split("\n");
    if (scenario.command === "clean_aube_metadata_cache") {
      assert.deepEqual(removed, []);
      assert.deepEqual(commands, ["cache delete *"]);
    } else {
      assert.deepEqual(removed, [
        ...(scenario.store ? [store] : []),
        path.join(cache, "aube"),
        path.join(os.homedir(), ".aube-store"),
      ]);
      assert.deepEqual(commands, ["cache delete *", "store path"]);
    }
  });
}
