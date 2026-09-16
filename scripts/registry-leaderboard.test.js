const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculateRegistryLeaderboard,
} = require("../app/src/lib/registry-leaderboard.ts");

function chart(data) {
  return {
    registryChartData: {
      variations: Object.keys(data),
      packageManagers: ["npm", "vlt", "aws"],
      data,
    },
  };
}

test("five fixture wins outweigh one arbitrarily large fixture", () => {
  const data = chart({
    "registry-clean": [
      ...["next", "astro", "vue", "svelte", "large"].map((fixture) => ({
        fixture,
        npm: 10,
        vlt: 6,
        aws: 20,
      })),
      { fixture: "babylon", npm: 100, vlt: 10000, aws: 20000 },
    ],
  });
  assert.deepEqual(
    calculateRegistryLeaderboard(data).map(
      ({ packageManager, wins, totalTests }) => ({
        packageManager,
        wins,
        totalTests,
      }),
    ),
    [
      { packageManager: "vlt", wins: 5, totalTests: 6 },
      { packageManager: "npm", wins: 1, totalTests: 6 },
      { packageManager: "aws", wins: 0, totalTests: 6 },
    ],
  );
});

test("DNF, partial, missing and non-finite values earn no wins or completions", () => {
  const data = chart({
    "registry-clean": [
      { fixture: "next", npm: 3, vlt: 1, vlt_dnf: true },
      { fixture: "astro", npm: 3, vlt: 1, vlt_partial: true, aws: Infinity },
      { fixture: "vue", npm: 3, vlt: 1, vlt_dnf: true, npm_dnf: true },
      { fixture: "svelte", npm: 0, vlt: -1, aws: NaN },
    ],
  });
  assert.deepEqual(calculateRegistryLeaderboard(data), [
    { packageManager: "npm", wins: 2, totalTests: 4, completedTests: 2 },
    { packageManager: "aws", wins: 0, totalTests: 4, completedTests: 0 },
    { packageManager: "vlt", wins: 0, totalTests: 4, completedTests: 0 },
  ]);
});

test("ties each earn a win and sort alphabetically without timing tiebreakers", () => {
  const data = chart({
    "registry-clean": [{ fixture: "next", npm: 4, vlt: 4, aws: 1000 }],
  });
  assert.deepEqual(
    calculateRegistryLeaderboard(data).map(({ packageManager, wins }) => [
      packageManager,
      wins,
    ]),
    [
      ["npm", 1],
      ["vlt", 1],
      ["aws", 0],
    ],
  );
});

test("fixture and variation filters recompute wins and common denominators", () => {
  const data = chart({
    "registry-clean": [
      { fixture: "next", npm: 4, vlt: 3 },
      { fixture: "astro", npm: 4, vlt: 5 },
    ],
    "registry-lockfile": [{ fixture: "next", npm: 4, vlt: 5 }],
  });
  const filtered = calculateRegistryLeaderboard(
    data,
    "registry-clean",
    new Set(["next"]),
  );
  assert.equal(filtered[0].packageManager, "vlt");
  assert.equal(filtered[0].wins, 1);
  assert.equal(filtered[0].totalTests, 1);
  const average = calculateRegistryLeaderboard(data, "average");
  assert.equal(average[0].packageManager, "npm");
  assert.equal(average[0].wins, 2);
  assert.equal(average[0].totalTests, 3);
  assert.deepEqual(
    calculateRegistryLeaderboard(data, "average", new Set()),
    [],
  );
  assert.deepEqual(calculateRegistryLeaderboard({}), []);
});
