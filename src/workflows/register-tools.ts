/**
 * Registers cross-integration workflow tools onto an existing McpServer.
 *
 * These tools combine multiple integrations (e.g. Spotify + Ticketmaster) into
 * a single high-level operation that's awkward to express by chaining the
 * underlying tools manually.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findGigsForLikedArtists } from "./liked-artists-gigs.js";

export function registerWorkflowTools(server: McpServer) {
  server.tool(
    "find_gigs_for_liked_artists",
    "Cross-reference the user's Spotify liked-track artists with upcoming gigs in a city via Ticketmaster.",
    {
      city: z.string().default("Melbourne").describe("City to search for gigs in"),
      country_code: z
        .string()
        .length(2)
        .default("AU")
        .describe("ISO 3166-1 alpha-2 country code"),
      max_tracks: z
        .number()
        .min(1)
        .max(2000)
        .default(200)
        .describe("Cap on liked tracks scanned from Spotify"),
      max_artists: z
        .number()
        .min(1)
        .max(500)
        .default(100)
        .describe("Cap on distinct artists to query Ticketmaster for"),
    },
    async ({ city, country_code, max_tracks, max_artists }) => {
      const result = await findGigsForLikedArtists({
        city,
        countryCode: country_code,
        maxTracks: max_tracks,
        maxArtists: max_artists,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
