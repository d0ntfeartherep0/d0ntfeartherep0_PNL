"""Tools for searching Spotify's catalog."""

from typing import Any

from src.spotify_client import get_client, normalize_artist, normalize_track


def search_tracks(query: str, limit: int = 20) -> list[dict[str, Any]]:
    """Search for tracks on Spotify.

    Supports Spotify search syntax like:
        - "chill dream pop"
        - "artist:Tame Impala"
        - "genre:indie year:2020-2024"

    Args:
        query: Search query string.
        limit: Number of results to return (1-50).
    """
    sp = get_client()
    results = sp.search(q=query, type="track", limit=min(limit, 50))
    return [normalize_track(t) for t in results["tracks"]["items"]]


def search_artists(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search for artists on Spotify.

    Args:
        query: Search query string.
        limit: Number of results to return (1-50).
    """
    sp = get_client()
    results = sp.search(q=query, type="artist", limit=min(limit, 50))
    return [normalize_artist(a) for a in results["artists"]["items"]]
