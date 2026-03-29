/**
 * Standalone script to generate a digest on demand.
 * Usage: npm run digest
 */

import { connectWhatsApp } from "../whatsapp/client.js";
import { generateAndSaveDigest } from "./generator.js";

async function main() {
  console.log("Connecting to WhatsApp...");
  await connectWhatsApp();

  console.log("Generating digest...");
  const filepath = await generateAndSaveDigest(24);
  console.log(`Digest saved to: ${filepath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Digest generation failed:", err);
  process.exit(1);
});
