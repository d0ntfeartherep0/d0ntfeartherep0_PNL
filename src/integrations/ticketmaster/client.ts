/**
 * Ticketmaster Discovery API client.
 *
 * Free tier: get a consumer key from https://developer.ticketmaster.com.
 * Set TICKETMASTER_API_KEY in the environment.
 *
 * Note: Ticketmaster doesn't have full coverage of small/grass-roots venues —
 * for richer indie/local listings, layer in Bandsintown or Songkick later.
 * The shape of `Gig` and `findGigs` is intentionally source-agnostic so
 * additional providers can be added behind the same interface.
 */

const TM_BASE = "https://app.ticketmaster.com/discovery/v2";

export interface Gig {
  artist: string; // queried artist
  eventName: string;
  date: string; // ISO datetime if known, else local date
  venue: string;
  city: string;
  url: string;
  source: "ticketmaster";
}

export interface FindGigsOptions {
  artist: string;
  city: string;
  countryCode?: string; // ISO 3166-1 alpha-2 (e.g. "AU")
  apiKey?: string;
}

interface TmEvent {
  name: string;
  url: string;
  dates?: { start?: { dateTime?: string; localDate?: string } };
  _embedded?: {
    venues?: { name: string; city?: { name: string } }[];
    attractions?: { name: string }[];
  };
}

interface TmResponse {
  _embedded?: { events?: TmEvent[] };
  page?: { totalElements: number };
}

export async function findGigs(opts: FindGigsOptions): Promise<Gig[]> {
  const apiKey = opts.apiKey || process.env.TICKETMASTER_API_KEY;
  if (!apiKey) throw new Error("TICKETMASTER_API_KEY is required");

  const params = new URLSearchParams({
    apikey: apiKey,
    keyword: opts.artist,
    city: opts.city,
    sort: "date,asc",
    size: "20",
  });
  if (opts.countryCode) params.set("countryCode", opts.countryCode);

  const url = `${TM_BASE}/events.json?${params.toString()}`;
  const res = await fetch(url);
  if (res.status === 429) {
    // Discovery API: 5 req/sec, 5000/day. Brief back-off then retry once.
    await new Promise((r) => setTimeout(r, 1500));
    return findGigs(opts);
  }
  if (!res.ok) {
    throw new Error(`Ticketmaster ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as TmResponse;
  const events = data._embedded?.events || [];
  const lower = opts.artist.toLowerCase();

  // Ticketmaster's keyword match is fuzzy — require artist-name substring in
  // either the event title or one of the linked attractions to cut noise.
  return events
    .filter((e) => {
      const inName = e.name.toLowerCase().includes(lower);
      const inAttr = e._embedded?.attractions?.some((a) =>
        a.name.toLowerCase().includes(lower)
      );
      return inName || inAttr;
    })
    .map((e) => ({
      artist: opts.artist,
      eventName: e.name,
      date: e.dates?.start?.dateTime || e.dates?.start?.localDate || "",
      venue: e._embedded?.venues?.[0]?.name || "",
      city: e._embedded?.venues?.[0]?.city?.name || opts.city,
      url: e.url,
      source: "ticketmaster" as const,
    }));
}

/**
 * Run gig lookups for many artists with bounded concurrency, staying under
 * Ticketmaster's 5 req/sec rate limit.
 */
export async function findGigsForArtists(
  artists: string[],
  opts: Omit<FindGigsOptions, "artist"> & { concurrency?: number }
): Promise<Map<string, Gig[]>> {
  const concurrency = opts.concurrency ?? 3;
  const results = new Map<string, Gig[]>();
  let i = 0;

  async function worker() {
    while (i < artists.length) {
      const idx = i++;
      const artist = artists[idx];
      try {
        results.set(artist, await findGigs({ ...opts, artist }));
      } catch (err) {
        console.error(`[ticketmaster] ${artist} failed:`, (err as Error).message);
        results.set(artist, []);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
