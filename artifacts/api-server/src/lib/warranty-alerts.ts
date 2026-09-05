import { warrantyDaysRemaining, warrantyWindow, type WarrantyWindow } from "./notify-recipients";

export type WarrantyAlertRow = {
  assetId: string;
  assetTag: string;
  assetName: string;
  warrantyEnd: string;
  window: WarrantyWindow;
  daysRemaining: number;
};

const ALERT_LIMIT = 8;

export function toWarrantyAlert(
  asset: { id: string; assetTag: string; name: string; warrantyEnd: string | null },
  today: Date = new Date(),
): WarrantyAlertRow | null {
  if (!asset.warrantyEnd) return null;
  const window = warrantyWindow(asset.warrantyEnd, today);
  const daysRemaining = warrantyDaysRemaining(asset.warrantyEnd, today);
  if (!window || daysRemaining == null) return null;
  return {
    assetId: asset.id,
    assetTag: asset.assetTag,
    assetName: asset.name,
    warrantyEnd: asset.warrantyEnd,
    window,
    daysRemaining,
  };
}

export function collectWarrantyAlerts(
  assets: Array<{ id: string; assetTag: string; name: string; warrantyEnd: string | null }>,
  today: Date = new Date(),
  limit = ALERT_LIMIT,
): WarrantyAlertRow[] {
  return assets
    .map((asset) => toWarrantyAlert(asset, today))
    .filter((alert): alert is WarrantyAlertRow => alert !== null)
    .sort((a, b) => a.daysRemaining - b.daysRemaining || a.assetTag.localeCompare(b.assetTag))
    .slice(0, limit);
}
