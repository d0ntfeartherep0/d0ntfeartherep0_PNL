/**
 * Thin Spotify Web API client. Each function fetches a valid access token
 * via the auth module (handles refresh transparently).
 */

import { getAccessToken } from "./auth.js";

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: { id: string; name: string };
  added_at?: string;
}

interface RawSavedTrackItem {
  added_at: string;
  track: {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    album: { id: string; name: string };
  } | null;
}

interface RawPagedSavedTracks {
  items: RawSavedTrackItem[];
  next: string | null;
  total: number;
}

const API_BASE = "https://api.spotify.com/v1";

async function spotifyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 429) {
    // Respect Spotify rate-limit hint, then retry once.
    const retryAfter = Number(res.headers.get("retry-after") || "1");
    await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
    return spotifyFetch<T>(path, init);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify ${res.status} ${res.statusText} on ${url}: ${text}`);
  }
  return (await res.json()) as T;
}

/**
 * Fetch saved (liked) tracks. Pages through Spotify's 50-per-page limit.
 * If `max` is provided, stops once that many are collected.
 */
export async function getSavedTracks(opts: { max?: number } = {}): Promise<SpotifyTrack[]> {
  const out: SpotifyTrack[] = [];
  let url: string | null = `${API_BASE}/me/tracks?limit=50`;
  while (url) {
    const page: RawPagedSavedTracks = await spotifyFetch(url);
    for (const item of page.items) {
      if (!item.track) continue;
      out.push({
        id: item.track.id,
        name: item.track.name,
        artists: item.track.artists.map((a) => ({ id: a.id, name: a.name })),
        album: item.track.album,
        added_at: item.added_at,
      });
      if (opts.max && out.length >= opts.max) return out;
    }
    url = page.next;
  }
  return out;
}

/**
 * Deduplicated artists across the user's liked tracks.
 * Useful for "which of my artists have gigs near me" workflows.
 */
export async function getSavedArtists(opts: { max?: number } = {}): Promise<SpotifyArtist[]> {
  const tracks = await getSavedTracks({ max: opts.max });
  const seen = new Map<string, SpotifyArtist>();
  for (const t of tracks) {
    for (const a of t.artists) {
      if (!seen.has(a.id)) seen.set(a.id, a);
    }
  }
  return [...seen.values()];
}

export async function getCurrentlyPlaying(): Promise<SpotifyTrack | null> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 204) return null; // nothing playing
  if (!res.ok) throw new Error(`Spotify ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    item: {
      id: string;
      name: string;
      artists: { id: string; name: string }[];
      album: { id: string; name: string };
    } | null;
  };
  if (!data.item) return null;
  return {
    id: data.item.id,
    name: data.item.name,
    artists: data.item.artists.map((a) => ({ id: a.id, name: a.name })),
    album: data.item.album,
  };
}

export async function searchTracks(query: string, limit = 10): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q: query, type: "track", limit: String(limit) });
  const data = await spotifyFetch<{
    tracks: {
      items: {
        id: string;
        name: string;
        artists: { id: string; name: string }[];
        album: { id: string; name: string };
      }[];
    };
  }>(`/search?${params.toString()}`);
  return data.tracks.items.map((t) => ({
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
    album: t.album,
  }));
}
