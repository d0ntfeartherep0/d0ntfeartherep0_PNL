import { store } from "../whatsapp/store.js";
import { isConnected } from "../whatsapp/client.js";

export interface ListChatsParams {
  limit: number;
}

export async function listChats({ limit }: ListChatsParams) {
  if (!isConnected()) {
    return { error: "WhatsApp is not connected. Please authenticate first." };
  }

  const chats = store.getChats();

  const sorted = chats
    .sort(
      (a, b) =>
        ((b.conversationTimestamp as number) || 0) -
        ((a.conversationTimestamp as number) || 0)
    )
    .slice(0, limit);

  return sorted.map((chat) => {
    const contact = store.getContact(chat.id);
    return {
      id: chat.id,
      name: contact?.name || contact?.notify || chat.name || chat.id,
      lastMessageTime: chat.conversationTimestamp
        ? new Date(
            (chat.conversationTimestamp as number) * 1000
          ).toISOString()
        : null,
      unreadCount: chat.unreadCount || 0,
      isGroup: chat.id.endsWith("@g.us"),
    };
  });
}
