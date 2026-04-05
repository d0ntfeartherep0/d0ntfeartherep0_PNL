/**
 * Standalone auth setup script.
 * Run this first to authenticate with WhatsApp:
 *   npm run auth
 *
 * This will display a QR code in the terminal.
 * Scan it with WhatsApp on your phone:
 *   Settings > Linked Devices > Link a Device
 *
 * Once authenticated, credentials are saved to auth_state/
 * and the MCP server will auto-reconnect on future runs.
 */

import { connectWhatsApp, getConnectionInfo } from "./whatsapp/client.js";

async function main() {
  console.log("=== WhatsApp Authentication Setup ===");
  console.log("");
  console.log("A QR code will appear below.");
  console.log("Scan it with your phone's WhatsApp app:");
  console.log("  Settings > Linked Devices > Link a Device");
  console.log("");

  await connectWhatsApp();

  const info = getConnectionInfo();
  if (info.connected) {
    console.log("");
    console.log(`✓ Connected as: ${info.user?.name} (${info.user?.id})`);
    console.log("✓ Credentials saved to auth_state/");
    console.log("");
    console.log("You can now use the MCP server: npm start");
    process.exit(0);
  } else {
    console.log("");
    console.log("Connection timed out. Please try again: npm run auth");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Auth setup failed:", err);
  process.exit(1);
});
