import type {
  WASocket,
  WAMessage,
  Chat,
  Contact,
} from "@whiskeysockets/baileys";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

interface StoredMessage {
  key: WAMessage["key"];
  message: WAMessage["message"];
  messageTimestamp: number;
  pushName?: string | null;
}

const STORE_PATH =
  process.env.WHATSAPP_STORE_PATH ||
  join(process.env.WHATSAPP_DIGEST_DIR || "./digests", ".message-store.json");

const LAST_RUN_PATH =
  process.env.WHATSAPP_LAST_RUN_PATH ||
  join(process.env.WHATSAPP_DIGEST_DIR || "./digests", ".last-run");

class MessageStore {
  chats: Map<string, Chat> = new Map();
  contacts: Map<string, Contact> = new Map();
  messages: Map<string, StoredMessage[]> = new Map();
  private historySyncComplete = false;
  private historySyncResolve: (() => void) | null = null;

  constructor() {
    this.loadFromDisk();
  }

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

    // Track live messages
    sock.ev.on("messages.upsert", ({ messages: newMessages }) => {
      for (const msg of newMessages) {
        this.addMessage(msg);
      }
    });

    // Track history sync messages
    sock.ev.on(
      "messaging-history.set",
      ({ messages: historyMessages, isLatest }) => {
        for (const msg of historyMessages) {
          this.addMessage(msg);
        }

        if (isLatest) {
          this.historySyncComplete = true;
          if (this.historySyncResolve) {
            this.historySyncResolve();
            this.historySyncResolve = null;
          }
        }
      }
    );
  }

  private addMessage(msg: WAMessage) {
    const chatId = msg.key.remoteJid;
    if (!chatId) return;

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

    // Keep max 2000 messages per chat in memory
    if (chatMessages.length > 2000) {
      chatMessages.splice(0, chatMessages.length - 2000);
    }
  }

  /** Wait for Baileys initial history sync, with a timeout */
  async waitForSync(timeoutMs: number = 30_000): Promise<void> {
    if (this.historySyncComplete) return;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, timeoutMs);

      this.historySyncResolve = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  /** Persist messages to disk */
  saveToDisk(): void {
    const data: Record<string, StoredMessage[]> = {};
    for (const [chatId, msgs] of this.messages) {
      data[chatId] = msgs;
    }

    const contacts: Record<string, Contact> = {};
    for (const [id, contact] of this.contacts) {
      contacts[id] = contact;
    }

    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeFileSync(
      STORE_PATH,
      JSON.stringify({ messages: data, contacts }, null, 0),
      "utf-8"
    );
  }

  /** Load persisted messages from disk */
  private loadFromDisk(): void {
    if (!existsSync(STORE_PATH)) return;

    try {
      const raw = JSON.parse(readFileSync(STORE_PATH, "utf-8"));

      if (raw.messages) {
        for (const [chatId, msgs] of Object.entries(raw.messages)) {
          this.messages.set(chatId, msgs as StoredMessage[]);
        }
      }

      if (raw.contacts) {
        for (const [id, contact] of Object.entries(raw.contacts)) {
          this.contacts.set(id, contact as Contact);
        }
      }

      console.log(
        `[store] Loaded ${this.messages.size} chats from disk`
      );
    } catch {
      console.error("[store] Failed to load store from disk, starting fresh");
    }
  }

  /** Save last successful run timestamp */
  static saveLastRun(): void {
    mkdirSync(dirname(LAST_RUN_PATH), { recursive: true });
    writeFileSync(LAST_RUN_PATH, new Date().toISOString(), "utf-8");
  }

  /** Get last successful run timestamp, or null if first run */
  static getLastRun(): Date | null {
    if (!existsSync(LAST_RUN_PATH)) return null;
    try {
      const ts = readFileSync(LAST_RUN_PATH, "utf-8").trim();
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  isGroupChat(jid: string): boolean {
    return jid.endsWith("@g.us");
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
export { store, MessageStore };
