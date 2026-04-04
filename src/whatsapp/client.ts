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

export interface ConnectOptions {
  /** If true, show QR codes for interactive auth. If false, fail on auth required. */
  interactive?: boolean;
}

export async function connectWhatsApp(
  options: ConnectOptions = {}
): Promise<WASocket> {
  const { interactive = false } = options;
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await getAuthState();

  sock = makeWASocket({
    version,
    logger,
    auth: state,
  });

  // Bind our custom store to socket events
  store.bind(sock);

  sock.ev.on("creds.update", saveCreds);

  // Wait for connection result
  const result = await new Promise<"open" | "auth_required" | "failed">(
    (resolve) => {
      const timeout = setTimeout(() => {
        resolve("failed");
      }, interactive ? 120_000 : 30_000);

      sock!.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          if (!interactive) {
            clearTimeout(timeout);
            resolve("auth_required");
            return;
          }
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
              "[whatsapp] Logged out. Delete auth_state/ and re-authenticate."
            );
            clearTimeout(timeout);
            resolve("auth_required");
          } else if (interactive) {
            console.error(
              `[whatsapp] Disconnected (reason: ${reason}), reconnecting...`
            );
            setTimeout(() => connectWhatsApp(options), 3000);
          } else {
            clearTimeout(timeout);
            resolve("failed");
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

  return sock;
}
