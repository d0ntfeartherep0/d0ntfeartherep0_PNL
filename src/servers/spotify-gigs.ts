/**
 * MCP server entrypoint: Spotify + Ticketmaster + cross-integration workflows.
 *
 * Each integration owns its own tool registration; this entrypoint stays thin
 * and just composes them. Add new integrations by importing their
 * register-tools function.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSpotifyTools } from "../integrations/spotify/register-tools.js";
import { registerTicketmasterTools } from "../integrations/ticketmaster/register-tools.js";
import { registerWorkflowTools } from "../workflows/register-tools.js";

const server = new McpServer({
  name: "spotify-gigs",
  version: "0.1.0",
});

registerSpotifyTools(server);
registerTicketmasterTools(server);
registerWorkflowTools(server);

async function main() {
  console.error("[spotify-gigs] Starting MCP server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[spotify-gigs] MCP server running on stdio");
}

main().catch((err) => {
  console.error("[spotify-gigs] Fatal error:", err);
  process.exit(1);
});
