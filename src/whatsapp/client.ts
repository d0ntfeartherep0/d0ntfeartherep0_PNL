import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { existsSync } from "fs";
import { getAuthState } from "./auth.js";
import { store } from "./store.js";

const logger = pino({ level: process.env.LOG_LEVEL || "silent" });
const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR || "./auth_state";

let sock: WASocket | null = null;
let connectionReady = false;

function hasStoredCredentials(): boolean {
  // Baileys stores creds.json in the auth directory
  return existsSync(`${AUTH_DIR}/creds.json`);
}

export function isConnected(): boolean {
  return connectionReady && sock !== null;
}

export function getSocket(): WASocket {
  if (!sock) {
    throw new Error(
      "WhatsApp not connected. Run the auth setup first: npm run auth"
    );
  }
  return sock;
}

export function getConnectionInfo(): {
  connected: boolean;
  user: { id: string; name: string } | null;
} {
  if (!sock || !connectionReady) {
    return { connected: false, user: null };
  }
  const user = sock.user;
  return {
    connected: true,
    user: user ? { id: user.id, name: user.name || "Unknown" } : null,
  };
}

export interface ConnectOptions {
  /** If true, show QR codes for interactive auth. If false, fail on auth required. */
  interactive?: boolean;
}

async function createSocket(): Promise<WASocket> {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await getAuthState();

  const s = makeWASocket({
    version,
    logger,
    auth: state,
  });

  sock = s;
  store.bind(s);
  s.ev.on("creds.update", saveCreds);

  return s;
}

export async function connectWhatsApp(
  options: ConnectOptions = {}
): Promise<WASocket> {
  const { interactive = false } = options;
  const hasCreds = hasStoredCredentials();

  // No credentials at all — must authenticate interactively
  if (!hasCreds && !interactive) {
    throw new Error(
      "No WhatsApp credentials found. Please authenticate first:\n" +
        "  1. Run: npm run auth\n" +
        "  2. Scan the QR code with your phone\n" +
        "  3. Then run: npm run digest"
    );
  }

  let qrCount = 0;
  let currentSock = await createSocket();

  const result = await new Promise<"open" | "auth_required" | "failed">(
    (resolve) => {
      const timeout = setTimeout(() => {
        resolve("failed");
      }, interactive ? 120_000 : 60_000);

      function bindEvents(s: WASocket) {
        s.ev.on("connection.update", async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            qrCount++;
            if (interactive) {
              qrcode.generate(qr, { small: true });
              console.error(
                "[whatsapp] Scan the QR code above with WhatsApp on your phone"
              );
              console.error(
                "[whatsapp] Go to Settings > Linked Devices > Link a Device"
              );
            } else if (qrCount >= 3) {
              // Multiple QRs means creds are truly invalid
              clearTimeout(timeout);
              resolve("auth_required");
              return;
            } else {
              console.error(
                "[whatsapp] QR received, waiting for auto-reconnect with stored credentials..."
              );
            }
          }

          if (connection === "close") {
            connectionReady = false;
            const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;

            if (reason === DisconnectReason.loggedOut) {
              console.error(
                "[whatsapp] Logged out. Delete auth_state/ and re-authenticate."
              );
              clearTimeout(timeout);
              resolve("auth_required");
            } else {
              console.error(
                `[whatsapp] Disconnected (reason: ${reason}), reconnecting...`
              );
              setTimeout(async () => {
                try {
                  currentSock = await createSocket();
                  bindEvents(currentSock);
                } catch {
                  clearTimeout(timeout);
                  resolve("failed");
                }
              }, 3000);
            }
          } else if (connection === "open") {
            connectionReady = true;
            console.error(
              `[whatsapp] Connected as ${sock?.user?.name || sock?.user?.id}`
            );
            clearTimeout(timeout);
            resolve("open");
          }
        });
      }

      bindEvents(currentSock);
    }
  );

  if (result === "auth_required") {
    throw new Error(
      "WhatsApp authentication expired. Please re-authenticate:\n" +
        "  1. Delete the auth_state/ directory: rm -rf auth_state/\n" +
        "  2. Run: npm run auth\n" +
        "  3. Scan the QR code with your phone\n" +
        "  4. Then run: npm run digest"
    );
  }

  if (result === "failed") {
    throw new Error(
      "WhatsApp connection timed out. Check your internet connection and try again."
    );
  }

  return sock!;
}
