# Spotify Playlist MCP Server

An MCP (Model Context Protocol) server that lets Claude generate Spotify playlists based on your music taste. Claude acts as the recommendation engine — it fetches your listening data, applies its music knowledge, and creates curated playlists.

## How It Works

```
You: "Make me a chill Sunday morning playlist"

Claude:
  1. Fetches your top artists & tracks
  2. Analyzes your taste (genres, artists, mood patterns)
  3. Searches Spotify for matching tracks
  4. Curates the best results
  5. Creates the playlist on your Spotify account
```

## Setup

### 1. Spotify Developer App

You need a Spotify Developer app. If you don't have one:

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Add `http://127.0.0.1:8888/callback` as a Redirect URI
4. Copy your **Client ID**

### 2. Install Dependencies

```bash
pip install -e .
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your SPOTIFY_CLIENT_ID
```

### 4. Authenticate with Spotify

Run the one-time authentication script:

```bash
python scripts/authenticate.py
```

This opens your browser for Spotify login and caches the token locally.

### 5. Connect to Claude Code

Add to your Claude Code MCP settings (`~/.claude/settings.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "spotify": {
      "command": "python3",
      "args": ["src/server.py"],
      "cwd": "/path/to/this/repo",
      "env": {
        "SPOTIFY_CLIENT_ID": "your_client_id"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|---|---|
| `spotify_get_top_tracks` | Your top tracks (short/medium/long term) |
| `spotify_get_top_artists` | Your top artists with genres |
| `spotify_get_recent_tracks` | Last 50 recently played tracks |
| `spotify_get_saved_tracks` | Your liked songs (paginated) |
| `spotify_search_tracks` | Search tracks with Spotify query syntax |
| `spotify_search_artists` | Search for artists |
| `spotify_create_playlist` | Create a playlist with tracks |
| `spotify_add_tracks_to_playlist` | Add tracks to an existing playlist |
| `spotify_get_my_playlists` | List your playlists |
| `spotify_get_playlist_tracks` | Get tracks from a playlist |

## Example Prompts

- "What have I been listening to lately?"
- "Make me a workout playlist based on my taste"
- "Create a dinner party playlist — something mellow and jazzy"
- "Build a road trip playlist with my favorite artists plus some new discoveries"
- "What are my top genres? Make a playlist exploring similar genres I might not know"

## Notes

- **Spotify Development Mode** requires Premium and allows max 5 authorized users
- The Recommendations and Audio Features endpoints are unavailable for new apps (Nov 2024) — Claude uses its own music knowledge instead
- Recently played tracks are limited to the last 50 by Spotify's API
- Token auto-refreshes; re-run `authenticate.py` only if the refresh token expires
