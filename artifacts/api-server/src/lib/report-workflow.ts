import type { ComplianceReportStatus } from "@workspace/db/schema";
import { COMPLIANCE_REPORT_STATUSES } from "@workspace/db/schema";

const STAGE_ORDER: Record<ComplianceReportStatus, number> = {
  in_preparation: 0,
  ready_for_review: 1,
  final: 2,
};

/**
 * Validate a compliance-report patch.
 * Returns an HTTP status + message when the patch must be rejected.
 */
export function reportPatchRejection(
  current: ComplianceReportStatus,
  nextStatus: ComplianceReportStatus | undefined,
): { status: 400 | 409; error: string } | null {
  if (current === "final") {
    return { status: 409, error: "Finalized reports cannot be modified." };
  }
  if (nextStatus === undefined || nextStatus === current) return null;
  const from = STAGE_ORDER[current];
  const to = STAGE_ORDER[nextStatus];
  if (!COMPLIANCE_REPORT_STATUSES.includes(nextStatus) || to < from) {
    return {
      status: 400,
      error: `Invalid workflow transition from ${current} to ${nextStatus}.`,
    };
  }
  return null;
}
