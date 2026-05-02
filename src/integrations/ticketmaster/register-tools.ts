/**
 * Registers Ticketmaster MCP tools onto an existing McpServer instance.
 *
 * Cross-integration workflows (e.g. "liked Spotify artists with gigs") live
 * in src/workflows/ and are registered separately by server entrypoints.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findGigs } from "./client.js";

export function registerTicketmasterTools(server: McpServer) {
  server.tool(
    "ticketmaster_find_gigs",
    "Search Ticketmaster Discovery API for upcoming events matching an artist in a given city.",
    {
      artist: z.string().describe("Artist or attraction name"),
      city: z.string().describe("City name (e.g. 'Melbourne')"),
      country_code: z
        .string()
        .length(2)
        .optional()
        .describe("ISO 3166-1 alpha-2 country code (e.g. 'AU')"),
    },
    async ({ artist, city, country_code }) => {
      const gigs = await findGigs({ artist, city, countryCode: country_code });
      return { content: [{ type: "text", text: JSON.stringify(gigs, null, 2) }] };
    }
  );
}
