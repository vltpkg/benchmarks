import { errorResponse, historyOf, strictReport, unknownTools } from "@/lib/api";
import { loadReportParams } from "@/lib/params";

/** One scenario's trend, failures and coverage, narrowed to `tools` (comma-separated). */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ section: string; scenario: string }> },
) => {
  const { section, scenario } = await params;
  const search = new URL(request.url).searchParams;
  const query = loadReportParams(search);
  const tools = search.get("tools")?.split(",").filter(Boolean) ?? [];
  const result = await strictReport({ section, scenario: decodeURIComponent(scenario), query });
  if ("error" in result) return errorResponse(result.error);
  const unknown = unknownTools(result.report, tools);
  return unknown === null ? Response.json(historyOf(result.report, tools)) : errorResponse(unknown);
};
