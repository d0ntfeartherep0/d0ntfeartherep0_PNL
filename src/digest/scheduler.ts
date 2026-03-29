import cron from "node-cron";
import { generateAndSaveDigest } from "./generator.js";

const CRON_SCHEDULE = process.env.WHATSAPP_DIGEST_CRON || "0 8 * * *";

export function startDigestScheduler() {
  console.error(`[digest] Scheduling daily digest with cron: ${CRON_SCHEDULE}`);

  cron.schedule(CRON_SCHEDULE, async () => {
    console.error("[digest] Running scheduled digest...");
    try {
      const filepath = await generateAndSaveDigest(24);
      console.error(`[digest] Saved to: ${filepath}`);
    } catch (err) {
      console.error("[digest] Failed to generate digest:", err);
    }
  });
}
