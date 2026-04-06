import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

SPOTIFY_CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID", "")
SPOTIFY_REDIRECT_URI = os.environ.get(
    "SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8888/callback"
)
SPOTIFY_TOKEN_CACHE_PATH = str(Path(
    os.environ.get("SPOTIFY_TOKEN_CACHE_PATH", "~/.spotify_pnl_cache")
).expanduser())

SPOTIFY_SCOPES = " ".join([
    "user-read-recently-played",
    "user-top-read",
    "user-library-read",
    "playlist-modify-private",
    "playlist-modify-public",
    "playlist-read-private",
])
