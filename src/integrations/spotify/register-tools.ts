/**
 * Registers Spotify MCP tools onto an existing McpServer instance.
 *
 * This module owns *all* MCP-tool wiring for Spotify. New Spotify tools should
 * be added here so the server entrypoints stay thin.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getSavedTracks,
  getSavedArtists,
  getCurrentlyPlaying,
  searchTracks,
} from "./client.js";

export function registerSpotifyTools(server: McpServer) {
  server.tool(
    "spotify_get_saved_tracks",
    "Get the user's liked (saved) tracks from Spotify, paged from /me/tracks.",
    {
      max: z
        .number()
        .min(1)
        .max(2000)
        .default(200)
        .describe("Maximum number of tracks to return (default 200)"),
    },
    async ({ max }) => {
      const tracks = await getSavedTracks({ max });
      return { content: [{ type: "text", text: JSON.stringify(tracks, null, 2) }] };
    }
  );

  server.tool(
    "spotify_get_saved_artists",
    "Get the deduplicated list of artists across the user's liked tracks.",
    {
      max_tracks: z
        .number()
        .min(1)
        .max(2000)
        .default(200)
        .describe("Cap on liked tracks scanned (default 200)"),
    },
    async ({ max_tracks }) => {
      const artists = await getSavedArtists({ max: max_tracks });
      return { content: [{ type: "text", text: JSON.stringify(artists, null, 2) }] };
    }
  );

  server.tool(
    "spotify_get_currently_playing",
    "Get the track currently playing on the user's Spotify, or null if nothing is playing.",
    {},
    async () => {
      const track = await getCurrentlyPlaying();
      return { content: [{ type: "text", text: JSON.stringify(track, null, 2) }] };
    }
  );

  server.tool(
    "spotify_search_tracks",
    "Search Spotify for tracks matching a query string.",
    {
      query: z.string().describe("Search query"),
      limit: z.number().min(1).max(50).default(10).describe("Result count"),
    },
    async ({ query, limit }) => {
      const tracks = await searchTracks(query, limit);
      return { content: [{ type: "text", text: JSON.stringify(tracks, null, 2) }] };
    }
  );
}
