import { getDigest } from "../tools/get-digest.js";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const DIGEST_DIR = process.env.WHATSAPP_DIGEST_DIR || "./digests";

export async function generateAndSaveDigest(hours: number = 24): Promise<string> {
  const digest = await getDigest({ hours });

  if ("error" in digest) {
    return `Digest generation failed: ${digest.error}`;
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeLabel = now.getHours() < 12 ? "AM" : "PM";
  const filename = `digest-${dateStr}-${timeLabel}.md`;

  let md = `# WhatsApp Digest - ${dateStr} ${timeLabel}\n\n`;
  md += `**Period:** ${digest.period}\n`;
  md += `**From:** ${digest.from}\n`;
  md += `**To:** ${digest.to}\n`;
  md += `**Total chats:** ${digest.totalChats} | **Total messages:** ${digest.totalMessages}\n\n`;
  md += `---\n\n`;

  for (const chat of digest.chats) {
    md += `## ${chat.chatName}\n`;
    md += `*${chat.messageCount} messages*\n\n`;

    for (const msg of chat.messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      md += `- **${msg.sender}** (${time}): ${msg.content}\n`;
    }
    md += `\n`;
  }

  mkdirSync(DIGEST_DIR, { recursive: true });
  const filepath = join(DIGEST_DIR, filename);
  writeFileSync(filepath, md, "utf-8");

  return filepath;
}
