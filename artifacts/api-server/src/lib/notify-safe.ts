import { logger } from "./logger";

/** Product emails must never fail the API mutation. */
export async function notifySafely(label: string, task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (err) {
    logger.error({ err, label }, "email notify failed");
  }
}
