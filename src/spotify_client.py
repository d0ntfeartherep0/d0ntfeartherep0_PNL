"""Thin wrapper around Spotipy that normalizes API responses."""

from typing import Any

import spotipy

from src.auth import get_spotify_client as _get_client

_client: spotipy.Spotify | None = None


def get_client() -> spotipy.Spotify:
    """Get or create the singleton Spotify client."""
    global _client
    if _client is None:
        _client = _get_client()
    return _client


# --- Response normalization helpers ---


def normalize_track(track: dict[str, Any]) -> dict[str, Any]:
    """Extract the essential fields from a Spotify track object."""
    artists = ", ".join(a["name"] for a in track.get("artists", []))
    album = track.get("album", {})
    return {
        "name": track.get("name"),
        "artist": artists,
        "album": album.get("name") if album else None,
        "uri": track.get("uri"),
        "id": track.get("id"),
    }


def normalize_artist(artist: dict[str, Any]) -> dict[str, Any]:
    """Extract the essential fields from a Spotify artist object."""
    return {
        "name": artist.get("name"),
        "genres": artist.get("genres", []),
        "uri": artist.get("uri"),
        "id": artist.get("id"),
    }


def normalize_playlist(playlist: dict[str, Any]) -> dict[str, Any]:
    """Extract the essential fields from a Spotify playlist object."""
    owner = playlist.get("owner", {})
    return {
        "name": playlist.get("name"),
        "id": playlist.get("id"),
        "uri": playlist.get("uri"),
        "description": playlist.get("description"),
        "track_count": playlist.get("tracks", {}).get("total", 0),
        "owner": owner.get("display_name") or owner.get("id"),
        "public": playlist.get("public"),
        "url": playlist.get("external_urls", {}).get("spotify"),
    }
