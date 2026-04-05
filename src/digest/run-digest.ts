/**
 * Standalone script to generate a digest on demand.
 * Usage: npm run digest
 *
 * - First run: includes up to 6 months of history (group chats capped at 25 messages)
 * - Subsequent runs: only messages since last successful digest
 * - Persists message store to disk so history accumulates across runs
 */

import { connectWhatsApp } from "../whatsapp/client.js";
import { store, MessageStore } from "../whatsapp/store.js";
import { generateAndSaveDigest } from "./generator.js";

async function main() {
  const lastRun = MessageStore.getLastRun();

  if (lastRun) {
    const hoursAgo = Math.round(
      (Date.now() - lastRun.getTime()) / 3600000
    );
    console.log(`Last digest: ${lastRun.toLocaleString()} (${hoursAgo}h ago)`);
  } else {
    console.log("First run — will include available message history");
  }

  console.log("Connecting to WhatsApp...");
  await connectWhatsApp();

  // Wait for Baileys to sync message history
  const syncTimeout = lastRun ? 15_000 : 45_000;
  console.log(
    `Waiting for message sync (up to ${syncTimeout / 1000}s)...`
  );
  await store.waitForSync(syncTimeout);

  // Brief extra pause to catch any trailing messages
  await new Promise((r) => setTimeout(r, 3000));

  console.log("Generating digest...");
  const filepath = await generateAndSaveDigest();
  console.log(`Digest saved to: ${filepath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Digest generation failed:", err);
  process.exit(1);
});
