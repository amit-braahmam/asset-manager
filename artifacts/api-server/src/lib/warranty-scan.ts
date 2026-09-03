import { eq } from "drizzle-orm";
import { assetsTable, db, peopleTable } from "@workspace/db";
import { logger } from "./logger";
import { notify } from "./notify";
import { warrantyWindow } from "./notify-recipients";

export async function runWarrantyScan(now = new Date()): Promise<{ scanned: number; notified: number }> {
  const rows = await db
    .select({
      asset: assetsTable,
      personEmail: peopleTable.email,
    })
    .from(assetsTable)
    .leftJoin(peopleTable, eq(assetsTable.assigneeId, peopleTable.id));

  let notified = 0;
  for (const row of rows) {
    const end = row.asset.warrantyEnd;
    if (!end) continue;
    const window = warrantyWindow(end, now);
    if (!window) continue;
    await notify({
      type: "warranty",
      assetId: row.asset.id,
      assetTag: row.asset.assetTag,
      assetName: row.asset.name,
      warrantyEnd: end,
      window,
      assigneeEmail: row.personEmail,
    });
    notified += 1;
  }
  logger.info({ scanned: rows.length, notified }, "warranty scan complete");
  return { scanned: rows.length, notified };
}
