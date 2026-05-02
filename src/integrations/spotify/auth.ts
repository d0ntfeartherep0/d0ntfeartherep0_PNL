/**
 * Spotify OAuth (Authorization Code with PKCE) + token persistence.
 *
 * Persists tokens to SPOTIFY_AUTH_DIR/tokens.json. On every call, getAccessToken()
 * checks expiry and silently refreshes via the refresh_token grant.
 *
 * PKCE means we don't need a client secret — only a client ID and a registered
 * redirect URI in the Spotify Developer Dashboard.
 */

import { createHash, randomBytes } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const AUTH_DIR = process.env.SPOTIFY_AUTH_DIR || "./spotify_auth";
const TOKEN_FILE = join(AUTH_DIR, "tokens.json");

export const SPOTIFY_SCOPES = [
  "user-library-read",
  "user-read-currently-playing",
  "user-read-playback-state",
];

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  scope: string;
}

function readTokens(): StoredTokens | null {
  if (!existsSync(TOKEN_FILE)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeTokens(t: StoredTokens) {
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2), { mode: 0o600 });
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePkcePair() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    response_type: "code",
    redirect_uri: opts.redirectUri,
    code_challenge_method: "S256",
    code_challenge: opts.codeChallenge,
    state: opts.state,
    scope: SPOTIFY_SCOPES.join(" "),
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function postTokenEndpoint(body: URLSearchParams): Promise<StoredTokens> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token endpoint ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
  const existing = readTokens();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || existing?.refresh_token || "",
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
    scope: data.scope,
  };
}

export async function exchangeCodeForToken(opts: {
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<StoredTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    code_verifier: opts.codeVerifier,
  });
  const tokens = await postTokenEndpoint(body);
  writeTokens(tokens);
  return tokens;
}

async function refreshAccessToken(clientId: string, refreshToken: string): Promise<StoredTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const tokens = await postTokenEndpoint(body);
  writeTokens(tokens);
  return tokens;
}

/**
 * Returns a valid access token, refreshing if needed.
 * Throws if no tokens are stored — call the auth-setup CLI first.
 */
export async function getAccessToken(): Promise<string> {
  // Override for ad-hoc usage (e.g. one-off scripts with a hand-pasted token).
  if (process.env.SPOTIFY_ACCESS_TOKEN) return process.env.SPOTIFY_ACCESS_TOKEN;

  const stored = readTokens();
  if (!stored) {
    throw new Error(
      `No Spotify tokens found at ${TOKEN_FILE}. Run: npm run spotify-auth`
    );
  }
  if (Date.now() < stored.expires_at) return stored.access_token;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) throw new Error("SPOTIFY_CLIENT_ID is required to refresh tokens");
  if (!stored.refresh_token) throw new Error("No refresh_token stored — re-run spotify-auth");

  const refreshed = await refreshAccessToken(clientId, stored.refresh_token);
  return refreshed.access_token;
}

export function getTokenFilePath(): string {
  return TOKEN_FILE;
}
