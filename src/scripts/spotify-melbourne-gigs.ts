/**
 * Standalone CLI: print upcoming Melbourne gigs for artists from your liked
 * Spotify tracks. No MCP plumbing required.
 *
 * Required env:
 *   SPOTIFY_CLIENT_ID         (for token refresh; not needed if you set
 *                              SPOTIFY_ACCESS_TOKEN directly)
 *   TICKETMASTER_API_KEY      (https://developer.ticketmaster.com)
 *
 * One of:
 *   SPOTIFY_ACCESS_TOKEN      Hand-pasted bearer token (quickest)
 *     -- or --
 *   tokens.json saved by `npm run spotify-auth`
 *
 * Optional env:
 *   GIGS_CITY                 default: Melbourne
 *   GIGS_COUNTRY              default: AU
 *   GIGS_MAX_TRACKS           default: 200
 *   GIGS_MAX_ARTISTS          default: 100
 */

import { findGigsForLikedArtists } from "../workflows/liked-artists-gigs.js";

async function main() {
  const city = process.env.GIGS_CITY || "Melbourne";
  const countryCode = process.env.GIGS_COUNTRY || "AU";
  const maxTracks = Number(process.env.GIGS_MAX_TRACKS || "200");
  const maxArtists = Number(process.env.GIGS_MAX_ARTISTS || "100");

  console.log(`Looking up ${city}, ${countryCode} gigs for your liked artists...`);
  console.log(`(scanning up to ${maxTracks} tracks / ${maxArtists} artists)\n`);

  const result = await findGigsForLikedArtists({
    city,
    countryCode,
    maxTracks,
    maxArtists,
  });

  console.log(
    `Checked ${result.artistsChecked} artists — ${result.artistsWithGigs} have gigs.\n`
  );

  if (result.gigs.length === 0) {
    console.log("No upcoming gigs found.");
    return;
  }

  for (const gig of result.gigs) {
    const date = gig.date ? gig.date.slice(0, 10) : "TBA";
    console.log(`${date}  ${gig.artist}  —  ${gig.venue}`);
    console.log(`            ${gig.url}`);
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
