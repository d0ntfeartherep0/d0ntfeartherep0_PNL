"""Tools for creating and managing Spotify playlists."""

from typing import Any

from src.spotify_client import get_client, normalize_playlist, normalize_track


def create_playlist(
    name: str,
    track_uris: list[str] | None = None,
    description: str = "",
    public: bool = False,
) -> dict[str, Any]:
    """Create a new playlist and optionally add tracks.

    Args:
        name: Playlist name.
        track_uris: Optional list of Spotify track URIs to add.
        description: Optional playlist description.
        public: Whether the playlist is public (default: private).

    Returns:
        Playlist info including URL.
    """
    sp = get_client()
    user_id = sp.current_user()["id"]
    playlist = sp.user_playlist_create(
        user=user_id,
        name=name,
        public=public,
        description=description,
    )

    if track_uris:
        _add_tracks_in_batches(sp, playlist["id"], track_uris)

    return normalize_playlist(playlist)


def add_tracks_to_playlist(
    playlist_id: str,
    track_uris: list[str],
) -> dict[str, str]:
    """Add tracks to an existing playlist.

    Args:
        playlist_id: The Spotify playlist ID.
        track_uris: List of Spotify track URIs to add.

    Returns:
        Confirmation with snapshot ID.
    """
    sp = get_client()
    snapshot = _add_tracks_in_batches(sp, playlist_id, track_uris)
    return {"status": "success", "snapshot_id": snapshot, "tracks_added": len(track_uris)}


def get_my_playlists(limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
    """Get the current user's playlists.

    Args:
        limit: Number of playlists to return (1-50).
        offset: Starting position for pagination.
    """
    sp = get_client()
    results = sp.current_user_playlists(limit=min(limit, 50), offset=offset)
    return [normalize_playlist(p) for p in results["items"]]


def get_playlist_tracks(
    playlist_id: str,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Get tracks from a playlist.

    Args:
        playlist_id: The Spotify playlist ID.
        limit: Number of tracks to return (1-100).
        offset: Starting position for pagination.
    """
    sp = get_client()
    results = sp.playlist_items(playlist_id, limit=min(limit, 100), offset=offset)
    tracks = []
    for item in results["items"]:
        track = item.get("track")
        if track:
            tracks.append(normalize_track(track))
    return tracks


def _add_tracks_in_batches(sp, playlist_id: str, track_uris: list[str]) -> str:
    """Add tracks in batches of 100 (Spotify's limit per request)."""
    snapshot = None
    for i in range(0, len(track_uris), 100):
        batch = track_uris[i : i + 100]
        snapshot = sp.playlist_add_items(playlist_id, batch)
    return snapshot
