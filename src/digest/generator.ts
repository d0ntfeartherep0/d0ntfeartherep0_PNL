import { store, MessageStore, type StoredMessage } from "../whatsapp/store.js";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const DIGEST_DIR = process.env.WHATSAPP_DIGEST_DIR || "./digests";
const GROUP_MESSAGE_CAP = 25;

export async function generateAndSaveDigest(): Promise<string> {
  const lastRun = MessageStore.getLastRun();
  const now = new Date();

  // Determine lookback: since last run, or fallback to 12 hours
  let sinceTimestamp: number;
  let periodLabel: string;

  if (lastRun) {
    sinceTimestamp = Math.floor(lastRun.getTime() / 1000);
    const hoursAgo = Math.round((now.getTime() - lastRun.getTime()) / 3600000);
    periodLabel = `Since last digest (${hoursAgo}h ago, ${lastRun.toLocaleString()})`;
  } else {
    // First run — go back 6 months
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sinceTimestamp = Math.floor(sixMonthsAgo.getTime() / 1000);
    periodLabel = "First run — last 6 months (group chats capped at 25 messages)";
  }

  const chatIds = store.getAllChatIds();
  const digest: Array<{
    chatId: string;
    chatName: string;
    isGroup: boolean;
    messageCount: number;
    totalAvailable: number;
    truncated: boolean;
    messages: Array<{
      sender: string;
      content: string;
      timestamp: string;
    }>;
  }> = [];

  for (const cid of chatIds) {
    const allMessages = store.getMessages(cid);
    const recentMessages = allMessages.filter(
      (msg) => msg.messageTimestamp >= sinceTimestamp
    );

    if (recentMessages.length === 0) continue;

    // Sort by timestamp
    recentMessages.sort((a, b) => a.messageTimestamp - b.messageTimestamp);

    const isGroup = store.isGroupChat(cid);
    const totalAvailable = recentMessages.length;
    const truncated = isGroup && totalAvailable > GROUP_MESSAGE_CAP;

    // For group chats, take only the most recent N messages
    const displayMessages = truncated
      ? recentMessages.slice(-GROUP_MESSAGE_CAP)
      : recentMessages;

    const contact = store.getContact(cid);
    const chatName = contact?.name || contact?.notify || cid;

    digest.push({
      chatId: cid,
      chatName,
      isGroup,
      messageCount: displayMessages.length,
      totalAvailable,
      truncated,
      messages: displayMessages.map((msg) => ({
        sender: msg.key.fromMe
          ? "me"
          : msg.pushName || msg.key.participant || "unknown",
        content: getTextContent(msg),
        timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
      })),
    });
  }

  if (digest.length === 0) {
    return "Digest generation completed: no new messages found.";
  }

  // Sort: DMs first, then groups; within each, by message count desc
  digest.sort((a, b) => {
    if (a.isGroup !== b.isGroup) return a.isGroup ? 1 : -1;
    return b.messageCount - a.messageCount;
  });

  const dateStr = now.toISOString().split("T")[0];
  const timeLabel = now.getHours() < 12 ? "AM" : "PM";
  const filename = `digest-${dateStr}-${timeLabel}.md`;

  let md = `# WhatsApp Digest — ${dateStr} ${timeLabel}\n\n`;
  md += `**Period:** ${periodLabel}\n`;
  md += `**Generated:** ${now.toLocaleString()}\n`;
  md += `**Total chats:** ${digest.length} | **Total messages:** ${digest.reduce((sum, c) => sum + c.totalAvailable, 0)}\n\n`;
  md += `---\n\n`;

  // DMs section
  const dms = digest.filter((c) => !c.isGroup);
  if (dms.length > 0) {
    md += `# Direct Messages\n\n`;
    for (const chat of dms) {
      md += formatChat(chat);
    }
  }

  // Groups section
  const groups = digest.filter((c) => c.isGroup);
  if (groups.length > 0) {
    md += `# Group Chats\n\n`;
    for (const chat of groups) {
      md += formatChat(chat);
    }
  }

  mkdirSync(DIGEST_DIR, { recursive: true });
  const filepath = join(DIGEST_DIR, filename);
  writeFileSync(filepath, md, "utf-8");

  // Persist store and last run
  store.saveToDisk();
  MessageStore.saveLastRun();

  return filepath;
}

function formatChat(chat: {
  chatName: string;
  isGroup: boolean;
  messageCount: number;
  totalAvailable: number;
  truncated: boolean;
  messages: Array<{ sender: string; content: string; timestamp: string }>;
}): string {
  let md = `## ${chat.chatName}\n`;

  if (chat.truncated) {
    md += `*Showing ${chat.messageCount} of ${chat.totalAvailable} messages — request full history if needed*\n\n`;
  } else {
    md += `*${chat.messageCount} messages*\n\n`;
  }

  for (const msg of chat.messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const content = msg.content || "[unsupported message type]";
    md += `- **${msg.sender}** (${time}): ${content}\n`;
  }
  md += `\n`;

  return md;
}

function getTextContent(msg: { message: StoredMessage["message"] }): string {
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
