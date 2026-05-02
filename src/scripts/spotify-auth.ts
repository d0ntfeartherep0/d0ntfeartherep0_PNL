/**
 * One-shot CLI to acquire & persist a Spotify refresh token.
 *
 * Usage:
 *   SPOTIFY_CLIENT_ID=xxx npm run spotify-auth
 *
 * Flow:
 *   1. Spins up a tiny localhost HTTP server to catch the OAuth redirect
 *   2. Prints an authorize URL — open it in your browser
 *   3. After consent, Spotify redirects back here with ?code=...
 *   4. Exchanges the code (with PKCE verifier) for tokens, writes them to disk
 *
 * You must register the redirect URI in your Spotify app dashboard.
 * Default: http://127.0.0.1:8765/callback
 */

import { createServer } from "http";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  generatePkcePair,
  getTokenFilePath,
} from "../integrations/spotify/auth.js";

const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:8765/callback";

function parseRedirectPort(uri: string): number {
  const u = new URL(uri);
  return Number(u.port || (u.protocol === "https:" ? 443 : 80));
}

async function main() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    console.error("SPOTIFY_CLIENT_ID is required.");
    console.error("Get one at: https://developer.spotify.com/dashboard");
    console.error(`Then add ${REDIRECT_URI} as a redirect URI in your app settings.`);
    process.exit(1);
  }

  const { verifier, challenge } = generatePkcePair();
  const state = Math.random().toString(36).slice(2);
  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri: REDIRECT_URI,
    codeChallenge: challenge,
    state,
  });

  console.log("=== Spotify Authentication Setup ===\n");
  console.log("Open this URL in your browser to authorize:\n");
  console.log(`  ${authorizeUrl}\n`);
  console.log(`Listening for the callback on ${REDIRECT_URI} ...\n`);

  const port = parseRedirectPort(REDIRECT_URI);
  const callbackPath = new URL(REDIRECT_URI).pathname;

  const code: string = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== callbackPath) {
        res.writeHead(404).end();
        return;
      }
      const gotCode = url.searchParams.get("code");
      const gotState = url.searchParams.get("state");
      const err = url.searchParams.get("error");
      if (err) {
        res.writeHead(400, { "Content-Type": "text/plain" }).end(`Error: ${err}`);
        server.close();
        reject(new Error(err));
        return;
      }
      if (gotState !== state) {
        res.writeHead(400, { "Content-Type": "text/plain" }).end("State mismatch");
        server.close();
        reject(new Error("OAuth state mismatch"));
        return;
      }
      if (!gotCode) {
        res.writeHead(400, { "Content-Type": "text/plain" }).end("Missing code");
        server.close();
        reject(new Error("Missing code in callback"));
        return;
      }
      res
        .writeHead(200, { "Content-Type": "text/html" })
        .end("<h2>Spotify auth complete.</h2><p>You can close this tab.</p>");
      server.close();
      resolve(gotCode);
    });
    server.listen(port, "127.0.0.1");
  });

  const tokens = await exchangeCodeForToken({
    clientId,
    redirectUri: REDIRECT_URI,
    code,
    codeVerifier: verifier,
  });

  console.log(`Tokens saved to ${getTokenFilePath()}`);
  console.log(`Scopes granted: ${tokens.scope}`);
  console.log("\nYou can now run: npm run spotify-melbourne-gigs");
}

main().catch((err) => {
  console.error("Spotify auth failed:", err);
  process.exit(1);
});
