import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { getAuthState } from "./auth.js";
import { store } from "./store.js";

const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

let sock: WASocket | null = null;
let connectionReady = false;

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

/**
 * Connect to WhatsApp. Shows a QR code if authentication is needed.
 * Automatically retries on transient disconnects.
 * Times out after 120 seconds (enough time to scan a QR code).
 */
export async function connectWhatsApp(): Promise<WASocket> {
  let currentSock = await createSocket();

  const result = await new Promise<"open" | "logged_out">(
    (resolve) => {
      const timeout = setTimeout(() => {
        // Timed out — treat as success attempt failed but don't crash
        // so the digest can at least generate with whatever we have
        resolve("open");
      }, 120_000);

      function bindEvents(s: WASocket) {
        s.ev.on("connection.update", async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            qrcode.generate(qr, { small: true });
            console.error(
              "[whatsapp] Scan the QR code above with WhatsApp on your phone"
            );
            console.error(
              "[whatsapp] Go to Settings > Linked Devices > Link a Device"
            );
          }

          if (connection === "close") {
            connectionReady = false;
            const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;

            if (reason === DisconnectReason.loggedOut) {
              console.error(
                "[whatsapp] Logged out. Please re-authenticate by running: npm run auth"
              );
              clearTimeout(timeout);
              resolve("logged_out");
            } else {
              console.error(
                `[whatsapp] Disconnected (reason: ${reason}), reconnecting...`
              );
              setTimeout(async () => {
                try {
                  currentSock = await createSocket();
                  bindEvents(currentSock);
                } catch {
                  // Socket creation failed, keep waiting for timeout
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

  if (result === "logged_out") {
    throw new Error(
      "WhatsApp session was logged out. Please re-authenticate:\n" +
        "  1. Run: npm run auth\n" +
        "  2. Scan the QR code with your phone"
    );
  }

  return sock!;
}
