"""Tools for fetching user listening data from Spotify."""

from typing import Any

from src.spotify_client import get_client, normalize_artist, normalize_track


def get_top_tracks(
    time_range: str = "medium_term",
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Get the user's top tracks.

    Args:
        time_range: "short_term" (~4 weeks), "medium_term" (~6 months),
                    or "long_term" (years).
        limit: Number of tracks to return (1-50).
    """
    sp = get_client()
    results = sp.current_user_top_tracks(limit=min(limit, 50), time_range=time_range)
    return [normalize_track(t) for t in results["items"]]


def get_top_artists(
    time_range: str = "medium_term",
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Get the user's top artists.

    Args:
        time_range: "short_term" (~4 weeks), "medium_term" (~6 months),
                    or "long_term" (years).
        limit: Number of artists to return (1-50).
    """
    sp = get_client()
    results = sp.current_user_top_artists(limit=min(limit, 50), time_range=time_range)
    return [normalize_artist(a) for a in results["items"]]


def get_recent_tracks(limit: int = 50) -> list[dict[str, Any]]:
    """Get the user's recently played tracks (max 50).

    Args:
        limit: Number of tracks to return (1-50).
    """
    sp = get_client()
    results = sp.current_user_recently_played(limit=min(limit, 50))
    tracks = []
    for item in results["items"]:
        track = normalize_track(item["track"])
        track["played_at"] = item.get("played_at")
        tracks.append(track)
    return tracks


def get_saved_tracks(limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
    """Get the user's saved/liked tracks.

    Args:
        limit: Number of tracks to return (1-50).
        offset: Starting position for pagination.
    """
    sp = get_client()
    results = sp.current_user_saved_tracks(limit=min(limit, 50), offset=offset)
    return [normalize_track(item["track"]) for item in results["items"]]
