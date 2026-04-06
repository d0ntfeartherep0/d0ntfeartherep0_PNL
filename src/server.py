#!/usr/bin/env python3
"""Spotify Playlist MCP Server.

Exposes Spotify tools for Claude to read listening data, search tracks,
and create playlists based on the user's music taste.
"""

import json
import logging
import sys
from pathlib import Path

# Ensure project root is on the path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(
    level=logging.DEBUG,
    stream=sys.stderr,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

try:
    from mcp.server.fastmcp import FastMCP
    from src.tools import listening_data, playlists, search
    logger.info("All imports successful")
except Exception as e:
    logger.error(f"Import failed: {e}", exc_info=True)
    raise

mcp = FastMCP(
    "spotify-playlist-generator",
    instructions=(
        "Spotify integration for playlist generation. Use listening data tools "
        "to understand the user's music taste, search tools to find tracks, "
        "and playlist tools to create and manage playlists. "
        "You are the recommendation engine — combine the user's listening data "
        "with your music knowledge to curate great playlists."
    ),
)


# --- Listening Data Tools ---


@mcp.tool()
def spotify_get_top_tracks(
    time_range: str = "medium_term",
    limit: int = 20,
) -> str:
    """Get the user's top tracks from Spotify.

    Use this to understand what the user listens to most. Supports three
    time ranges for different perspectives on their taste.

    Args:
        time_range: "short_term" (~4 weeks), "medium_term" (~6 months),
                    or "long_term" (several years).
        limit: Number of tracks (1-50, default 20).
    """
    results = listening_data.get_top_tracks(time_range=time_range, limit=limit)
    return json.dumps(results, indent=2)


@mcp.tool()
def spotify_get_top_artists(
    time_range: str = "medium_term",
    limit: int = 20,
) -> str:
    """Get the user's top artists from Spotify, including their genres.

    Useful for understanding the user's genre preferences and finding
    similar artists for playlist generation.

    Args:
        time_range: "short_term" (~4 weeks), "medium_term" (~6 months),
                    or "long_term" (several years).
        limit: Number of artists (1-50, default 20).
    """
    results = listening_data.get_top_artists(time_range=time_range, limit=limit)
    return json.dumps(results, indent=2)


@mcp.tool()
def spotify_get_recent_tracks(limit: int = 50) -> str:
    """Get the user's recently played tracks (max 50).

    Shows what the user has been listening to right now, including timestamps.

    Args:
        limit: Number of tracks (1-50, default 50).
    """
    results = listening_data.get_recent_tracks(limit=limit)
    return json.dumps(results, indent=2)


@mcp.tool()
def spotify_get_saved_tracks(limit: int = 20, offset: int = 0) -> str:
    """Get the user's saved/liked tracks from their library.

    Use offset for pagination to browse through larger libraries.

    Args:
        limit: Number of tracks (1-50, default 20).
        offset: Starting position for pagination (default 0).
    """
    results = listening_data.get_saved_tracks(limit=limit, offset=offset)
    return json.dumps(results, indent=2)


# --- Search Tools ---


@mcp.tool()
def spotify_search_tracks(query: str, limit: int = 20) -> str:
    """Search for tracks on Spotify.

    Supports Spotify search syntax:
        - Free text: "chill dream pop"
        - By artist: "artist:Tame Impala"
        - By genre: "genre:indie"
        - By year: "year:2020-2024"
        - Combined: "artist:Khruangbin year:2020-2024"

    Use multiple targeted searches with different queries to build a diverse
    candidate pool for playlist generation.

    Args:
        query: Search query string.
        limit: Number of results (1-50, default 20).
    """
    results = search.search_tracks(query=query, limit=limit)
    return json.dumps(results, indent=2)


@mcp.tool()
def spotify_search_artists(query: str, limit: int = 10) -> str:
    """Search for artists on Spotify.

    Useful for discovering related artists or verifying artist names
    before searching for their tracks.

    Args:
        query: Search query string.
        limit: Number of results (1-50, default 10).
    """
    results = search.search_artists(query=query, limit=limit)
    return json.dumps(results, indent=2)


# --- Playlist Tools ---


@mcp.tool()
def spotify_create_playlist(
    name: str,
    track_uris: list[str] | None = None,
    description: str = "",
    public: bool = False,
) -> str:
    """Create a new Spotify playlist, optionally with tracks.

    Call this after curating a list of track URIs from search results
    and the user's library. Returns the playlist URL.

    Args:
        name: Playlist name.
        track_uris: List of Spotify track URIs (e.g. ["spotify:track:xxx"]).
        description: Optional description for the playlist.
        public: Whether the playlist is public (default: private).
    """
    result = playlists.create_playlist(
        name=name,
        track_uris=track_uris,
        description=description,
        public=public,
    )
    return json.dumps(result, indent=2)


@mcp.tool()
def spotify_add_tracks_to_playlist(
    playlist_id: str,
    track_uris: list[str],
) -> str:
    """Add tracks to an existing Spotify playlist.

    Args:
        playlist_id: The Spotify playlist ID.
        track_uris: List of Spotify track URIs to add.
    """
    result = playlists.add_tracks_to_playlist(
        playlist_id=playlist_id,
        track_uris=track_uris,
    )
    return json.dumps(result, indent=2)


@mcp.tool()
def spotify_get_my_playlists(limit: int = 20, offset: int = 0) -> str:
    """Get the current user's Spotify playlists.

    Args:
        limit: Number of playlists (1-50, default 20).
        offset: Starting position for pagination (default 0).
    """
    results = playlists.get_my_playlists(limit=limit, offset=offset)
    return json.dumps(results, indent=2)


@mcp.tool()
def spotify_get_playlist_tracks(
    playlist_id: str,
    limit: int = 50,
    offset: int = 0,
) -> str:
    """Get tracks from a Spotify playlist.

    Args:
        playlist_id: The Spotify playlist ID.
        limit: Number of tracks (1-100, default 50).
        offset: Starting position for pagination (default 0).
    """
    results = playlists.get_playlist_tracks(
        playlist_id=playlist_id,
        limit=limit,
        offset=offset,
    )
    return json.dumps(results, indent=2)


if __name__ == "__main__":
    mcp.run()
