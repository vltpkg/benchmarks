import { createMcpHandler } from "mcp-handler";
import { registerTools } from "@/lib/mcp";
import { SITE_NAME, siteOrigin } from "@/lib/metadata";

/* Stateless streamable HTTP, so a handler per request costs nothing and lets
   the tools write links against the origin that was asked. */
const handler = (request: Request) =>
  createMcpHandler((server) => registerTools(server, siteOrigin(request)), {
    serverInfo: { name: SITE_NAME, version: "1.0.0" },
  })(request);

export { handler as GET, handler as POST, handler as DELETE };
