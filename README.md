# WhatsApp MCP Server

An MCP (Model Context Protocol) server that connects Claude to your personal WhatsApp account. Manage messages, get daily digests, and send messages — all through Claude.

Built with [Baileys](https://github.com/WhiskeySockets/Baileys) (lightweight WebSocket-based WhatsApp Web API) and the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).

## Features

- **List chats** — See recent conversations with unread counts
- **Read messages** — View message history from any chat
- **Send messages** — Draft and send messages through Claude
- **Search messages** — Find messages by keyword across all chats
- **Daily digest** — Get a summary of all messages from the last 24 hours
- **Contact lookup** — Find contacts by name to get their chat ID
- **Multi-device** — Works alongside your phone and Mac WhatsApp apps

## Prerequisites

- Node.js 18+
- A WhatsApp account with a phone that can scan QR codes

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Authenticate with WhatsApp

```bash
npm run auth
```

This shows a QR code in the terminal. Scan it with your phone:
**WhatsApp > Settings > Linked Devices > Link a Device**

Credentials are saved to `auth_state/` and auto-reconnect on future runs.

### 3. Add to Claude Code

Add this MCP server to your Claude Code settings. Edit `~/.claude/settings.json` (or your project's `.claude/settings.json`):

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/whatsapp-mcp/src/index.ts"],
      "env": {
        "WHATSAPP_AUTH_DIR": "/absolute/path/to/whatsapp-mcp/auth_state"
      }
    }
  }
}
```

Restart Claude Code after adding the config.

### 4. Use with Claude

Ask Claude things like:
- "List my WhatsApp chats"
- "Read the last 20 messages from [contact name]"
- "Send a message to [contact] saying [message]"
- "Search my WhatsApp for messages about [topic]"
- "Give me a digest of my WhatsApp messages from the last 12 hours"
- "Check my WhatsApp connection status"

## Available Tools

| Tool | Description |
|------|-------------|
| `whatsapp_connection_status` | Check connection state and authenticated user |
| `whatsapp_list_chats` | List recent chats with names, timestamps, unread counts |
| `whatsapp_read_messages` | Read messages from a specific chat |
| `whatsapp_send_message` | Send a text message to a contact or group |
| `whatsapp_search_messages` | Search messages by keyword |
| `whatsapp_get_digest` | Get a digest of recent messages across all chats |
| `whatsapp_get_contacts` | Look up contacts by name |

## Daily Digest

### On-demand

Ask Claude: "Summarize my WhatsApp messages from today"

### Scheduled

The MCP server runs a cron job (default: 8:00 AM daily) that saves digests to `digests/digest-YYYY-MM-DD.md`.

Configure the schedule via environment variable:
```bash
WHATSAPP_DIGEST_CRON="0 8 * * *"  # cron expression
```

### Manual

```bash
npm run digest
```

## Configuration

Environment variables (set in `.env` or in the MCP server config):

| Variable | Default | Description |
|----------|---------|-------------|
| `WHATSAPP_AUTH_DIR` | `./auth_state` | Directory for session credentials |
| `WHATSAPP_DIGEST_DIR` | `./digests` | Directory for saved digests |
| `WHATSAPP_DIGEST_CRON` | `0 8 * * *` | Cron schedule for auto-digest |
| `LOG_LEVEL` | `warn` | Pino log level |

## Security Notes

- Session credentials in `auth_state/` give full access to your WhatsApp account — keep them secure
- The `auth_state/` directory is gitignored by default
- The `send_message` tool requires Claude's permission system approval before executing
- No message content is logged unless you change `LOG_LEVEL`

## How It Works

1. Baileys connects to WhatsApp's multi-device WebSocket protocol as a linked device
2. The MCP server exposes WhatsApp operations as tools that Claude can call
3. Claude uses stdio transport to communicate with the MCP server
4. Your phone and Mac WhatsApp apps continue working normally alongside this connection

## Spotify + Gigs (separate MCP server & CLI)

A second integration lives alongside WhatsApp under `src/integrations/spotify/`
and `src/integrations/ticketmaster/`. It can be used standalone (one-shot CLI)
or as its own MCP server.

### Repository layout

```
src/
  integrations/        one folder per external service
    spotify/           OAuth, API client, MCP tool registrations
    ticketmaster/      Discovery API client, MCP tool registrations
  workflows/           cross-integration logic (e.g. liked-artists-gigs)
  servers/             MCP server entrypoints (one per server)
  scripts/             standalone CLI runners
  whatsapp/, digest/, tools/, index.ts, auth-setup.ts   (existing WhatsApp)
```

To add a new integration: drop a folder under `src/integrations/<name>/` with
its own `client.ts` and `register-tools.ts`. Compose it into a server under
`src/servers/`. Cross-integration logic goes in `src/workflows/`.

### Setup

1. Create a Spotify app at https://developer.spotify.com/dashboard.
   - Add redirect URI: `http://127.0.0.1:8765/callback`
   - Note the Client ID
2. Get a Ticketmaster Discovery API key at https://developer.ticketmaster.com.
3. Authenticate (one-time):
   ```bash
   SPOTIFY_CLIENT_ID=xxx npm run spotify-auth
   ```
   Tokens are saved to `spotify_auth/tokens.json` (gitignored).

### Standalone CLI

```bash
SPOTIFY_CLIENT_ID=xxx \
TICKETMASTER_API_KEY=yyy \
npm run spotify-melbourne-gigs
```

Optional env: `GIGS_CITY` (default `Melbourne`), `GIGS_COUNTRY` (default `AU`),
`GIGS_MAX_TRACKS`, `GIGS_MAX_ARTISTS`.

### MCP server

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "spotify-gigs": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/d0ntfeartherep0_PNL/src/servers/spotify-gigs.ts"],
      "env": {
        "SPOTIFY_CLIENT_ID": "xxx",
        "SPOTIFY_AUTH_DIR": "/absolute/path/to/d0ntfeartherep0_PNL/spotify_auth",
        "TICKETMASTER_API_KEY": "yyy"
      }
    }
  }
}
```

Tools exposed:

| Tool | Description |
|------|-------------|
| `spotify_get_saved_tracks` | Liked tracks (paged) |
| `spotify_get_saved_artists` | Deduped artists across liked tracks |
| `spotify_get_currently_playing` | Currently playing track |
| `spotify_search_tracks` | Search Spotify for tracks |
| `ticketmaster_find_gigs` | Search events by artist + city |
| `find_gigs_for_liked_artists` | Combined: liked artists × city gigs |

## Troubleshooting

**QR code not showing:** Make sure you're running in a terminal that supports QR rendering. Try `npm run auth` directly.

**Disconnected frequently:** WhatsApp may disconnect linked devices that are inactive. The server auto-reconnects on non-logout disconnections.

**"Logged out" error:** WhatsApp revoked the session. Delete `auth_state/` and run `npm run auth` again.

**Messages not loading:** Baileys populates its in-memory store as messages arrive. Historical messages before the connection was established may not be available.
