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

const logger = pino({ level: process.env.LOG_LEVEL || "warn" });

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

export async function connectWhatsApp(): Promise<WASocket> {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await getAuthState();

  sock = makeWASocket({
    version,
    logger,
    auth: state,
    // QR is rendered manually via qrcode-terminal in connection.update handler
  });

  // Bind our custom store to socket events
  store.bind(sock);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
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
          "[whatsapp] Logged out. Delete auth_state/ and re-authenticate."
        );
      } else {
        console.error(
          `[whatsapp] Disconnected (reason: ${reason}), reconnecting...`
        );
        setTimeout(() => connectWhatsApp(), 3000);
      }
    } else if (connection === "open") {
      connectionReady = true;
      console.error(
        `[whatsapp] Connected as ${sock?.user?.name || sock?.user?.id}`
      );
    }
  });

  // Wait for initial connection (up to 60 seconds for QR scanning)
  await new Promise<void>((resolve) => {
    if (connectionReady) return resolve();

    const timeout = setTimeout(() => {
      resolve();
    }, 60_000);

    sock!.ev.on("connection.update", (update) => {
      if (update.connection === "open") {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  return sock;
}
