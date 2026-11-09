#!/usr/bin/env node
/**
 * The Markdown twins against a running site: what the @affordances/md handler
 * makes of each page's HTML, its slots filled. Not a vitest test: it needs a
 * server (`next start`, data from DATA_URL).
 *
 *   node apps/www/test/twins.e2e.mjs [http://localhost:3000]
 *
 * Exits non-zero, naming each failed check, if any fails.
 */
const base = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";
const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : `: ${detail}`}`);
  if (!ok) failures.push(name);
};
const get = (path, headers = {}) => fetch(new URL(path, base), { headers, redirect: "manual" });
const markdown = (res) => res.headers.get("content-type")?.startsWith("text/markdown") ?? false;

{
  const res = await get("/package-managers/clean.md");
  const text = await res.text();
  check("a report's twin is 200 Markdown", res.status === 200 && markdown(res), String(res.status));
  check(
    "a CDN may keep it an hour, and serve it stale an hour more",
    res.headers.get("cache-control") === "s-maxage=3600, stale-while-revalidate=3600",
    String(res.headers.get("cache-control")),
  );
  for (const heading of [
    "## Leaderboard",
    "### Performance over time",
    "### Total install time data",
    "## Cite",
  ]) {
    check(`it has "${heading}"`, text.includes(`\n${heading}\n`));
  }
  check("its trend is a CSV with a date column", /```csv\ndate,/.test(text));
  check("it states the filters in effect", text.includes("- Filters in effect:"));
  const perPackage = text.slice(text.indexOf("\n## Per-package install time\n"));
  check(
    "its per-package section says it is derived, and why a tool can be missing",
    perPackage.includes("Derived: install time divided by") &&
      perPackage.includes("divided by a guess"),
  );
  check("no figure is left as its chart's markup", !/^\*$/m.test(text));
  const negotiated = await get("/package-managers/clean?fixture=astro", {
    accept: "text/markdown",
  });
  check(
    "Accept: text/markdown at the page's URL redirects to its twin, query kept",
    negotiated.status === 307 &&
      negotiated.headers.get("location") === "/package-managers/clean.md?fixture=astro",
    `${negotiated.status} ${negotiated.headers.get("location")}`,
  );
  await negotiated.body?.cancel();
  const followed = await fetch(new URL("/package-managers/clean", base), {
    headers: { accept: "text/markdown" },
  });
  check("...which is the same twin", (await followed.text()) === text);
}
{
  const text = await (await get("/package-managers/clean.md?fixture=astro")).text();
  check(
    "the query is the filtered view",
    text.includes("  - fixture: astro") && /^# On Astro, /m.test(text),
  );
}
const notFound = async (path, ...lines) => {
  const res = await get(path);
  const text = await res.text();
  check(
    `${path} is a 404 no one caches`,
    res.status === 404 && res.headers.get("cache-control") === "private, no-store",
    `${res.status} ${res.headers.get("cache-control")}`,
  );
  check(
    `...that says where to go`,
    /^# 404: Page not found$/m.test(text) &&
      text.includes("/llms.txt)") &&
      lines.every((line) => text.includes(line)),
  );
};
await notFound("/nope.md", "There is no page at `/nope`");
await notFound("/package-managers/clean/extra.md", "`/package-managers/clean/extra`");
await notFound("/package-managers/nope.md", "published in this run: `clean`");
{
  const res = await get("/registries.md");
  check(
    "a section's twin redirects to its average's",
    res.status === 307 && res.headers.get("location")?.endsWith("/registries/average.md"),
    `${res.status} ${res.headers.get("location")}`,
  );
  const root = await get("/", { accept: "text/markdown" });
  check(
    "/ redirects (next.config.ts) before any twin",
    root.status === 307 && root.headers.get("location")?.endsWith("/registries/average"),
    `${root.status} ${root.headers.get("location")}`,
  );
}
{
  const text = await (await get("/methodology.md")).text();
  check("the Methodology twin is its written Markdown", /^# Methodology \(/m.test(text));
  const about = await get("/about.md");
  const index = await (await get("/llms.txt")).text();
  check(
    "the About twin is the llms.txt index",
    (await about.text()).endsWith(index) && index.includes("## Reading the results"),
  );
  check(
    "...cached like every twin",
    about.headers.get("cache-control") === "s-maxage=3600, stale-while-revalidate=3600",
  );
}
{
  const listed = ((await (await get("/llms.txt")).text()).match(/^- \[.+\]\(.+\.md\)/gm) ?? [])
    .length;
  const res = await get("/llms-full.txt");
  const pages = ((await res.text()).match(/^# .+ — .+ \(https?:\/\/[^)]+\)$/gm) ?? []).length;
  check(
    "llms-full.txt holds every page llms.txt lists, and a CDN may keep it",
    listed > 0 &&
      pages === listed &&
      res.headers.get("cache-control") === "s-maxage=3600, stale-while-revalidate=3600",
    `${pages} of ${listed} pages, ${res.headers.get("cache-control")}`,
  );
}
{
  const res = await get("/package-managers/clean");
  check(
    "the page links to its twin",
    (res.headers.get("link") ?? "").includes(
      '</package-managers/clean.md>; rel="alternate"; type="text/markdown"',
    ),
  );
  await res.body?.cancel();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failed`);
  process.exit(1);
}
console.log("\nall passed");
