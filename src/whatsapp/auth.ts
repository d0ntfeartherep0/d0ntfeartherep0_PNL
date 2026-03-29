import { useMultiFileAuthState } from "@whiskeysockets/baileys";
import { mkdirSync } from "fs";

const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR || "./auth_state";

export async function getAuthState() {
  mkdirSync(AUTH_DIR, { recursive: true });
  return useMultiFileAuthState(AUTH_DIR);
}
