import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { connectWhatsApp } from "./whatsapp/client.js";
import { listChats } from "./tools/list-chats.js";
import { readMessages } from "./tools/read-messages.js";
import { sendMessage } from "./tools/send-message.js";
import { searchMessages } from "./tools/search-messages.js";
import { getDigest } from "./tools/get-digest.js";
import { getContacts } from "./tools/get-contacts.js";
import { connectionStatus } from "./tools/connection-status.js";
import { startDigestScheduler } from "./digest/scheduler.js";

const server = new McpServer({
  name: "whatsapp",
  version: "1.0.0",
});

// --- Tool: whatsapp_connection_status ---
server.tool(
  "whatsapp_connection_status",
  "Check WhatsApp connection status and authenticated user info",
  {},
  async () => {
    const result = await connectionStatus();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Tool: whatsapp_list_chats ---
server.tool(
  "whatsapp_list_chats",
  "List recent WhatsApp chats with name, last message time, and unread count",
  { limit: z.number().min(1).max(100).default(20).describe("Number of chats to return") },
  async ({ limit }) => {
    const result = await listChats({ limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Tool: whatsapp_read_messages ---
server.tool(
  "whatsapp_read_messages",
  "Read messages from a specific WhatsApp chat. Use whatsapp_list_chats or whatsapp_get_contacts first to get the chat_id.",
  {
    chat_id: z.string().describe("Chat ID (e.g. '1234567890@s.whatsapp.net' for individual, or '12345@g.us' for group)"),
    limit: z.number().min(1).max(500).default(50).describe("Number of recent messages to return"),
  },
  async ({ chat_id, limit }) => {
    const result = await readMessages({ chat_id, limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Tool: whatsapp_send_message ---
server.tool(
  "whatsapp_send_message",
  "Send a WhatsApp message to a contact or group. IMPORTANT: Always confirm the message content with the user before sending.",
  {
    chat_id: z.string().describe("Chat ID or phone number (e.g. '1234567890' or '1234567890@s.whatsapp.net')"),
    message: z.string().describe("The text message to send"),
  },
  async ({ chat_id, message }) => {
    const result = await sendMessage({ chat_id, message });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Tool: whatsapp_search_messages ---
server.tool(
  "whatsapp_search_messages",
  "Search WhatsApp messages by keyword across all chats or within a specific chat",
  {
    query: z.string().describe("Search query text"),
    chat_id: z.string().optional().describe("Optional: limit search to a specific chat ID"),
    limit: z.number().min(1).max(100).default(20).describe("Max number of results"),
  },
  async ({ query, chat_id, limit }) => {
    const result = await searchMessages({ query, chat_id, limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Tool: whatsapp_get_digest ---
server.tool(
  "whatsapp_get_digest",
  "Get a digest/summary of recent WhatsApp messages grouped by chat. Great for daily summaries.",
  {
    hours: z.number().min(1).max(168).default(24).describe("Number of hours to look back (default 24)"),
    chat_ids: z.array(z.string()).optional().describe("Optional: limit to specific chat IDs"),
  },
  async ({ hours, chat_ids }) => {
    const result = await getDigest({ hours, chat_ids });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Tool: whatsapp_get_contacts ---
server.tool(
  "whatsapp_get_contacts",
  "Search for WhatsApp contacts by name. Use this to find a contact's chat ID before sending a message.",
  {
    query: z.string().optional().describe("Optional search query to filter contacts by name"),
  },
  async ({ query }) => {
    const result = await getContacts({ query });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Start server ---
async function main() {
  console.error("[whatsapp-mcp] Starting WhatsApp MCP server...");

  // Connect to WhatsApp (will show QR code on first run)
  try {
    await connectWhatsApp();
  } catch (err) {
    console.error("[whatsapp-mcp] Warning: WhatsApp connection failed:", err);
    console.error("[whatsapp-mcp] Server will start anyway - use whatsapp_connection_status to check");
  }

  // Start daily digest scheduler
  startDigestScheduler();

  // Start MCP server on stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[whatsapp-mcp] MCP server running on stdio");
}

main().catch((err) => {
  console.error("[whatsapp-mcp] Fatal error:", err);
  process.exit(1);
});
