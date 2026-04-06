#!/usr/bin/env python3
"""One-time Spotify OAuth authentication script.

Run this script to authorize the MCP server with your Spotify account.
It will open your browser for Spotify login, then cache the token
for subsequent use by the MCP server.

Usage:
    python scripts/authenticate.py
"""

import sys
from pathlib import Path

# Add project root to path so we can import src
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.auth import get_auth_manager


def main():
    print("Starting Spotify authentication...")
    print("A browser window will open for you to log in to Spotify.\n")

    auth_manager = get_auth_manager()

    # This triggers the full OAuth flow: opens browser, waits for callback,
    # exchanges code for token, and caches it.
    token_info = auth_manager.get_cached_token()
    if token_info and not auth_manager.is_token_expired(token_info):
        print("Found valid cached token — already authenticated!")
        print(f"Token cached at: {auth_manager.cache_handler.cache_path}")
        return

    # No valid token — run the authorization flow
    auth_url = auth_manager.get_authorize_url()
    print(f"Opening: {auth_url}\n")
    print("After authorizing, you'll be redirected to the callback URL.")
    print("Paste the full redirect URL here if the browser doesn't handle it automatically.\n")

    response_url = auth_manager.get_auth_response()
    code = auth_manager.parse_response_code(response_url)
    token_info = auth_manager.get_access_token(code)

    if token_info:
        print("\nAuthentication successful!")
        print(f"Token cached at: {auth_manager.cache_handler.cache_path}")
        print("The MCP server can now access your Spotify data.")
    else:
        print("\nAuthentication failed. Please try again.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
