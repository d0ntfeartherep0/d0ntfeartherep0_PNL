import { store, type StoredMessage } from "../whatsapp/store.js";
import { isConnected } from "../whatsapp/client.js";

export interface ReadMessagesParams {
  chat_id: string;
  limit: number;
}

function extractMessageContent(msg: StoredMessage): string {
  const m = msg.message;
  if (!m) return "[empty]";

  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return `[Image] ${m.imageMessage.caption}`;
  if (m.imageMessage) return "[Image]";
  if (m.videoMessage?.caption) return `[Video] ${m.videoMessage.caption}`;
  if (m.videoMessage) return "[Video]";
  if (m.audioMessage) return "[Audio]";
  if (m.documentMessage)
    return `[Document] ${m.documentMessage.fileName || ""}`;
  if (m.stickerMessage) return "[Sticker]";
  if (m.contactMessage)
    return `[Contact] ${m.contactMessage.displayName || ""}`;
  if (m.locationMessage) return "[Location]";
  if (m.reactionMessage) return `[Reaction] ${m.reactionMessage.text || ""}`;

  return "[Unsupported message type]";
}

export async function readMessages({ chat_id, limit }: ReadMessagesParams) {
  if (!isConnected()) {
    return { error: "WhatsApp is not connected. Please authenticate first." };
  }

  const messages = store.getMessages(chat_id);

  if (messages.length === 0) {
    return { error: `No messages found for chat: ${chat_id}` };
  }

  const recent = messages.slice(-limit);

  return recent.map((msg) => {
    const fromMe = msg.key.fromMe;
    const sender = fromMe
      ? "me"
      : msg.pushName || msg.key.participant || msg.key.remoteJid || "unknown";

    return {
      id: msg.key.id,
      sender,
      fromMe,
      content: extractMessageContent(msg),
      timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
    };
  });
}
