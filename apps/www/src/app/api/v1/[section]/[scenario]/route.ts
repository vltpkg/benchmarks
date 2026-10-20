import { errorResponse, strictReport } from "@/lib/api";
import { loadReportParams } from "@/lib/params";

/** One scenario's full report, with the same query parameters as its page. */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ section: string; scenario: string }> },
) => {
  const { section, scenario } = await params;
  const query = loadReportParams(new URL(request.url).searchParams);
  const result = await strictReport({ section, scenario: decodeURIComponent(scenario), query });
  return "error" in result ? errorResponse(result.error) : Response.json(result.report);
};
