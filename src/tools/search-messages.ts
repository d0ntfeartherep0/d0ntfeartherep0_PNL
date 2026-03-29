import { store, type StoredMessage } from "../whatsapp/store.js";
import { isConnected } from "../whatsapp/client.js";

export interface SearchMessagesParams {
  query: string;
  chat_id?: string;
  limit: number;
}

function getTextContent(msg: StoredMessage): string {
  const m = msg.message;
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  );
}

export async function searchMessages({
  query,
  chat_id,
  limit,
}: SearchMessagesParams) {
  if (!isConnected()) {
    return { error: "WhatsApp is not connected. Please authenticate first." };
  }

  const queryLower = query.toLowerCase();
  const results: Array<{
    chatId: string;
    chatName: string;
    sender: string;
    content: string;
    timestamp: string;
  }> = [];

  const chatIds = chat_id ? [chat_id] : store.getAllChatIds();

  for (const cid of chatIds) {
    const messages = store.getMessages(cid);

    for (const msg of messages) {
      if (results.length >= limit) break;

      const text = getTextContent(msg);
      if (text.toLowerCase().includes(queryLower)) {
        const contact = store.getContact(cid);
        results.push({
          chatId: cid,
          chatName: contact?.name || contact?.notify || cid,
          sender: msg.key.fromMe
            ? "me"
            : msg.pushName || msg.key.participant || "unknown",
          content: text,
          timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
        });
      }
    }

    if (results.length >= limit) break;
  }

  return results;
}
