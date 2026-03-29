import { store, type StoredMessage } from "../whatsapp/store.js";
import { isConnected } from "../whatsapp/client.js";

export interface GetDigestParams {
  hours: number;
  chat_ids?: string[];
}

function getTextContent(msg: StoredMessage): string {
  const m = msg.message;
  if (!m) return "";
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
  return "";
}

export async function getDigest({ hours, chat_ids }: GetDigestParams) {
  if (!isConnected()) {
    return { error: "WhatsApp is not connected. Please authenticate first." };
  }

  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const cutoffSeconds = Math.floor(cutoff / 1000);

  const chatIds = chat_ids || store.getAllChatIds();
  const digest: Array<{
    chatId: string;
    chatName: string;
    messageCount: number;
    messages: Array<{
      sender: string;
      content: string;
      timestamp: string;
    }>;
  }> = [];

  for (const cid of chatIds) {
    const messages = store.getMessages(cid);

    const recentMessages = messages.filter(
      (msg) => msg.messageTimestamp >= cutoffSeconds
    );

    if (recentMessages.length === 0) continue;

    const contact = store.getContact(cid);
    const chatName = contact?.name || contact?.notify || cid;

    digest.push({
      chatId: cid,
      chatName,
      messageCount: recentMessages.length,
      messages: recentMessages.map((msg) => ({
        sender: msg.key.fromMe
          ? "me"
          : msg.pushName || msg.key.participant || "unknown",
        content: getTextContent(msg),
        timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
      })),
    });
  }

  digest.sort((a, b) => b.messageCount - a.messageCount);

  return {
    period: `Last ${hours} hours`,
    from: new Date(cutoff).toISOString(),
    to: new Date().toISOString(),
    totalChats: digest.length,
    totalMessages: digest.reduce((sum, c) => sum + c.messageCount, 0),
    chats: digest,
  };
}
