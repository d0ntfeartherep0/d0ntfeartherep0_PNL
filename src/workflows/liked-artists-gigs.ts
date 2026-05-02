/**
 * Workflow: cross-reference a user's liked-on-Spotify artists with upcoming
 * gigs in a given city via the Ticketmaster Discovery API.
 *
 * This file is the single source of truth for the orchestration logic. It is
 * imported by both:
 *   - the standalone script (src/scripts/spotify-melbourne-gigs.ts)
 *   - the MCP tool registration (src/integrations/.../register-tools.ts)
 *
 * Adding more cities, additional gig sources, or richer matching belongs here.
 */

import { getSavedArtists } from "../integrations/spotify/client.js";
import { findGigsForArtists, type Gig } from "../integrations/ticketmaster/client.js";

export interface LikedArtistsGigsOptions {
  city: string;
  countryCode?: string;
  /** Cap the number of liked tracks paged from Spotify (perf vs. completeness). */
  maxTracks?: number;
  /** Cap how many distinct artists we look up gigs for (Ticketmaster cost). */
  maxArtists?: number;
  ticketmasterApiKey?: string;
}

export interface LikedArtistsGigsResult {
  city: string;
  artistsChecked: number;
  artistsWithGigs: number;
  gigs: Gig[];
}

export async function findGigsForLikedArtists(
  opts: LikedArtistsGigsOptions
): Promise<LikedArtistsGigsResult> {
  const artists = await getSavedArtists({ max: opts.maxTracks });
  const names = artists
    .slice(0, opts.maxArtists ?? artists.length)
    .map((a) => a.name);

  const gigsByArtist = await findGigsForArtists(names, {
    city: opts.city,
    countryCode: opts.countryCode,
    apiKey: opts.ticketmasterApiKey,
  });

  const gigs: Gig[] = [];
  let withGigs = 0;
  for (const artistGigs of gigsByArtist.values()) {
    if (artistGigs.length > 0) withGigs++;
    gigs.push(...artistGigs);
  }
  gigs.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  return {
    city: opts.city,
    artistsChecked: names.length,
    artistsWithGigs: withGigs,
    gigs,
  };
}
