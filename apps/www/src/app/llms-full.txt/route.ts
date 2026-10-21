import { connection } from "next/server";
import { loadCatalog } from "@/lib/catalog";
import { dataClient } from "@/lib/data";
import { reportMarkdown } from "@/lib/markdown";
import { siteOrigin } from "@/lib/metadata";
import { loadReportParams } from "@/lib/params";
import { loadReport } from "@/lib/report";
import { withAverage } from "@/lib/scenarios";
import { SECTIONS } from "@/lib/sections";

export const GET = async (request: Request) => {
  await connection();
  const client = dataClient();
  const { scenarios } = await loadCatalog(client);
  const query = loadReportParams(new URLSearchParams());
  const texts = await Promise.all(
    SECTIONS.flatMap((section) =>
      withAverage(scenarios[section]).map(async ({ variation }) => {
        const result = await loadReport({ section, scenario: variation, query, client });
        return result.status === "ok" ? reportMarkdown(result.report, siteOrigin(request)) : "";
      }),
    ),
  );
  return new Response(texts.filter(Boolean).join("\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
