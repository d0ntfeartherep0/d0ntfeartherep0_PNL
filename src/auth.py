import spotipy
from spotipy.oauth2 import SpotifyOAuth

from src.config import (
    SPOTIFY_CLIENT_ID,
    SPOTIFY_REDIRECT_URI,
    SPOTIFY_SCOPES,
    SPOTIFY_TOKEN_CACHE_PATH,
)


def get_auth_manager() -> SpotifyOAuth:
    """Create a SpotifyOAuth manager with PKCE-compatible settings."""
    if not SPOTIFY_CLIENT_ID:
        raise ValueError(
            "SPOTIFY_CLIENT_ID is not set. "
            "Copy .env.example to .env and add your Client ID."
        )
    return SpotifyOAuth(
        client_id=SPOTIFY_CLIENT_ID,
        client_secret=None,
        redirect_uri=SPOTIFY_REDIRECT_URI,
        scope=SPOTIFY_SCOPES,
        cache_path=SPOTIFY_TOKEN_CACHE_PATH,
        open_browser=True,
    )


def get_spotify_client() -> spotipy.Spotify:
    """Get an authenticated Spotify client using cached credentials."""
    auth_manager = get_auth_manager()
    token_info = auth_manager.cache_handler.get_cached_token()
    if not token_info:
        raise RuntimeError(
            "No cached Spotify token found. "
            "Run 'python scripts/authenticate.py' first to authorize."
        )
    return spotipy.Spotify(auth_manager=auth_manager)
