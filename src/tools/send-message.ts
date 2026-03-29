import { getSocket, isConnected } from "../whatsapp/client.js";

export interface SendMessageParams {
  chat_id: string;
  message: string;
}

export async function sendMessage({ chat_id, message }: SendMessageParams) {
  if (!isConnected()) {
    return { error: "WhatsApp is not connected. Please authenticate first." };
  }

  const sock = getSocket();

  // Normalize chat_id: add @s.whatsapp.net for individual chats if not already present
  let jid = chat_id;
  if (!jid.includes("@")) {
    jid = `${jid}@s.whatsapp.net`;
  }

  const result = await sock.sendMessage(jid, { text: message });

  return {
    success: true,
    messageId: result?.key.id,
    to: jid,
    message,
    timestamp: new Date().toISOString(),
  };
}
