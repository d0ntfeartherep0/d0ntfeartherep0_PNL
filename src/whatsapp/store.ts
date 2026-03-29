import type { WASocket, WAMessage, Chat, Contact } from "@whiskeysockets/baileys";

interface StoredMessage {
  key: WAMessage["key"];
  message: WAMessage["message"];
  messageTimestamp: number;
  pushName?: string | null;
}

class MessageStore {
  chats: Map<string, Chat> = new Map();
  contacts: Map<string, Contact> = new Map();
  messages: Map<string, StoredMessage[]> = new Map();

  bind(sock: WASocket) {
    // Track chats
    sock.ev.on("chats.upsert", (newChats) => {
      for (const chat of newChats) {
        this.chats.set(chat.id, { ...this.chats.get(chat.id), ...chat });
      }
    });

    sock.ev.on("chats.update", (updates) => {
      for (const update of updates) {
        const existing = this.chats.get(update.id!);
        if (existing) {
          this.chats.set(update.id!, { ...existing, ...update });
        }
      }
    });

    // Track contacts
    sock.ev.on("contacts.upsert", (newContacts) => {
      for (const contact of newContacts) {
        this.contacts.set(contact.id, contact);
      }
    });

    sock.ev.on("contacts.update", (updates) => {
      for (const update of updates) {
        const existing = this.contacts.get(update.id!);
        if (existing) {
          this.contacts.set(update.id!, { ...existing, ...update });
        }
      }
    });

    // Track messages
    sock.ev.on("messages.upsert", ({ messages: newMessages }) => {
      for (const msg of newMessages) {
        const chatId = msg.key.remoteJid;
        if (!chatId) continue;

        if (!this.messages.has(chatId)) {
          this.messages.set(chatId, []);
        }

        const stored: StoredMessage = {
          key: msg.key,
          message: msg.message,
          messageTimestamp:
            typeof msg.messageTimestamp === "number"
              ? msg.messageTimestamp
              : Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
          pushName: msg.pushName,
        };

        const chatMessages = this.messages.get(chatId)!;

        // Avoid duplicates
        const existingIdx = chatMessages.findIndex(
          (m) => m.key.id === msg.key.id
        );
        if (existingIdx >= 0) {
          chatMessages[existingIdx] = stored;
        } else {
          chatMessages.push(stored);
        }

        // Keep max 1000 messages per chat in memory
        if (chatMessages.length > 1000) {
          chatMessages.splice(0, chatMessages.length - 1000);
        }
      }
    });
  }

  getChats(): Chat[] {
    return Array.from(this.chats.values());
  }

  getContact(jid: string): Contact | undefined {
    return this.contacts.get(jid);
  }

  getMessages(chatId: string): StoredMessage[] {
    return this.messages.get(chatId) || [];
  }

  getAllChatIds(): string[] {
    return Array.from(this.messages.keys());
  }
}

const store = new MessageStore();

export type { StoredMessage };
export { store };
