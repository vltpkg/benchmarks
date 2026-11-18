import { afterEach, describe, expect, it, vi } from "vitest";
import { DataClient, DataFetchError, type DirectoryEntry } from "@benchmarks/data";
import { dataClient, fetchRetrying, probe } from "@/lib/data";
import { loadScenario } from "@/lib/load";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env["DATA_URL"];
});

/* Answer each request to a URL from its queue of statuses, the last one repeating. */
const answering = (plan: { [url: string]: number[] }) => {
  const seen: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    seen.push(url);
    const queue = plan[url] ?? [200];
    const status = queue.length > 1 ? (queue.shift() as number) : (queue[0] as number);
    return status === 200
      ? new Response('{"ok":true}', { status })
      : new Response(null, { status, headers: { "retry-after": "0" } });
  });
  return seen;
};

describe("fetchRetrying", () => {
  it("retries a 5xx with a short backoff and returns the answer that follows", async () => {
    const seen = answering({ "https://x/a.json": [503, 502, 200] });
    const response = await fetchRetrying("https://x/a.json");
    expect(response.status).toBe(200);
    expect(seen).toHaveLength(3);
  });

  it("gives up on a persistent 5xx after a couple of attempts", async () => {
    const seen = answering({ "https://x/a.json": [503] });
    const response = await fetchRetrying("https://x/a.json");
    expect(response.status).toBe(503);
    expect(seen).toHaveLength(3);
  });

  it("does not retry a 404", async () => {
    const seen = answering({ "https://x/a.json": [404] });
    expect((await fetchRetrying("https://x/a.json")).status).toBe(404);
    expect(seen).toHaveLength(1);
  });
});

describe("optional against required data", () => {
  it("treats a persistent 5xx on probed data as missing, with a warning", async () => {
    process.env["DATA_URL"] = "https://x";
    answering({ "https://x/2026-11-18/vue-registry-clean-process-count.json": [503] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = dataClient();
    const result = await probe(() =>
      client.getProcessCount("2026-11-18", "vue" as never, "registry-clean"),
    );
    expect(result.state).toBe("failed");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("503");
  });

  it("keeps a 404 on probed data as absent, without a warning", async () => {
    process.env["DATA_URL"] = "https://x";
    answering({ "https://x/2026-11-18/vue-registry-clean-process-count.json": [404] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = dataClient();
    const result = await probe(() =>
      client.getProcessCount("2026-11-18", "vue" as never, "registry-clean"),
    );
    expect(result).toMatchObject({ state: "absent", status: 404 });
    expect(warn).not.toHaveBeenCalled();
  });

  it("still fails loudly when data a page cannot render without answers 5xx", async () => {
    process.env["DATA_URL"] = "https://x";
    const seen = answering({ "https://x/index.json": [503] });
    const client = dataClient();
    const error = await client.getIndex().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataFetchError);
    expect((error as DataFetchError).status).toBe(503);
    /* After its retries, not before. */
    expect(seen).toHaveLength(3);
  });
});

describe("loadScenario", () => {
  const DATE = "2026-11-18";
  const results = [{ command: "npm", mean: 1, stddev: 0, exit_codes: [0] }];
  /* The run's shard: registry-clean publishes package counts but no process counts, build neither. */
  const entry: DirectoryEntry = {
    name: DATE,
    isLatest: false,
    fileCount: 0,
    benchmarks: {
      astro: ["clean", "registry-clean"],
      vue: ["clean", "registry-clean"],
      next: ["build"],
    },
    packageCounts: { astro: ["clean", "registry-clean"], vue: ["clean", "registry-clean"] },
    processCounts: { astro: ["clean"], vue: ["clean"] },
    hasChartData: false,
    hasVersions: true,
  };

  const recording = () => {
    const seen: string[] = [];
    const client = new DataClient({
      baseUrl: "https://x",
      fetch: async (url) => {
        seen.push(url.slice("https://x/".length));
        if (url.endsWith("manifest/" + DATE + ".json"))
          return { ok: true, status: 200, json: async () => entry };
        const count = /-(package|process)-count\.json$/.test(url);
        return {
          ok: true,
          status: 200,
          json: async () => (count ? { npm: { count: 10 } } : { results }),
        };
      },
    });
    return { client, seen };
  };

  it("requests only the count files the run's shard lists", async () => {
    const { client, seen } = recording();
    const data = await loadScenario(client, DATE, "registry-clean", ["astro", "vue"], [], {
      entry,
    });
    expect(seen.filter((u) => u.includes("process-count"))).toEqual([]);
    expect(seen.filter((u) => u.includes("package-count")).sort()).toEqual([
      `${DATE}/astro-registry-clean-package-count.json`,
      `${DATE}/vue-registry-clean-package-count.json`,
    ]);
    expect(data.bundles.map((b) => [b.fixture, b.counts !== null, b.processes])).toEqual([
      ["astro", true, null],
      ["vue", true, null],
    ]);
  });

  it("requests no count file for a scenario that publishes none", async () => {
    const { client, seen } = recording();
    const data = await loadScenario(client, DATE, "build", ["next"], [], { entry });
    expect(seen.filter((u) => u.includes("-count"))).toEqual([]);
    expect(data.bundles).toHaveLength(1);
  });

  it("requests both where the shard lists both", async () => {
    const { client, seen } = recording();
    const data = await loadScenario(client, DATE, "clean", ["astro"], [], { entry });
    expect(seen.filter((u) => u.includes("-count")).sort()).toEqual([
      `${DATE}/astro-clean-package-count.json`,
      `${DATE}/astro-clean-process-count.json`,
    ]);
    expect(data.bundles[0]?.processes).not.toBeNull();
  });

  it("fetches the shard itself when the caller has not", async () => {
    const { client, seen } = recording();
    await loadScenario(client, DATE, "registry-clean", ["astro"], []);
    expect(seen).toContain(`manifest/${DATE}.json`);
    expect(seen.filter((u) => u.includes("process-count"))).toEqual([]);
  });
});
