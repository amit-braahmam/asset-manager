import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateCustodyCheck,
  useGetCustodyCheck,
  useListCustodyChecks,
  useListDepartments,
  useListLocations,
  useRemindCustodyCheck,
  useSendCustodyCheckBatch,
  useUpdateCustodyCheck,
} from "@workspace/api-client-react";
import { Plus } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Modal,
  formatDate,
} from "@/components/asset-ui";
import { useToast } from "@/hooks/use-toast";

function apiErrorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return err instanceof Error ? err.message : fallback;
}

function defaultDue() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T17:00`;
}

export function CustodyChecks({
  canManage,
  showStart,
  onShowStart,
}: {
  canManage: boolean;
  showStart: boolean;
  onShowStart: (open: boolean) => void;
}) {
  const checks = useListCustodyChecks();
  const createCheck = useCreateCustodyCheck();
  const client = useQueryClient();
  const { toast } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Card className="table-card" style={{ marginTop: 13, padding: 20 }} data-testid="custody-checks">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Possession</div>
          <h2>Custody checks</h2>
          <p>Ask assigned people to confirm they still have their equipment. Mail goes out in batches so the domain stays safe.</p>
        </div>
        {canManage && <Button className="button-accent" data-testid="button-start-custody" onClick={() => onShowStart(true)}><Plus size={16} /> Start check</Button>}
      </div>
      {checks.isLoading ? <LoadingBlock /> : checks.isError ? <EmptyState title="Could not load custody checks" text="Retry from Reports after the API is running." /> : checks.data?.length ? (
        <div className="table-scroll">
          <table className="asset-table">
            <thead><tr><th>Check</th><th>Due</th><th>Mail</th><th>Answers</th><th /></tr></thead>
            <tbody>
              {checks.data.map((check) => (
                <tr key={check.id} data-testid={`row-custody-${check.id}`} onClick={() => setOpenId(check.id)}>
                  <td><b>{check.title}</b><small className="mono" style={{ display: "block", marginTop: 4 }}>{check.status === "open" ? "Open" : "Closed"} · {check.batchSize}/{check.cadence}</small></td>
                  <td className="muted">{formatDate(check.dueAt)}</td>
                  <td className="muted">{check.sentCount} sent · {check.queuedCount} queued</td>
                  <td className="muted">{check.confirmedCount} confirmed · {check.deniedCount} missing · {check.pendingCount} waiting</td>
                  <td><button className="text-button" onClick={(event) => { event.stopPropagation(); setOpenId(check.id); }}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="No custody checks yet" text={canManage ? "Start a check to email assigned custodians in batches." : "Admins and Auditors start possession checks from this page."} />}
      {showStart && (
        <Modal title="Start custody check" onClose={() => onShowStart(false)}>
          <CustodyForm
            submitting={createCheck.isPending}
            onCancel={() => onShowStart(false)}
            onSubmit={async (values) => {
              await createCheck.mutateAsync({ data: values });
              onShowStart(false);
              await client.invalidateQueries();
              toast({ title: "Custody check queued" });
            }}
          />
        </Modal>
      )}
      {openId && <CustodyDetail checkId={openId} canManage={canManage} onClose={() => setOpenId(null)} />}
    </Card>
  );
}

function CustodyForm({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (values: { title: string; dueAt: string; batchSize: number; cadence: "hour" | "day"; locationId: string | null; departmentId: string | null }) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const locations = useListLocations();
  const departments = useListDepartments();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(defaultDue);
  const [batchSize, setBatchSize] = useState("25");
  const [cadence, setCadence] = useState<"hour" | "day">("hour");
  const [locationId, setLocationId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({
        title,
        dueAt: new Date(dueAt).toISOString(),
        batchSize: Number(batchSize) || 25,
        cadence,
        locationId: locationId || null,
        departmentId: departmentId || null,
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to start this check."));
    }
  }

  return (
    <form className="asset-form" onSubmit={submit}>
      <p className="modal-intro">Only assigned assets are included. Emails wait in a queue and leave in the batch size you set, every hour or once a day.</p>
      <label className="field field-full"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="September custody check" required /></label>
      <div className="form-grid">
        <label className="field"><span>Due</span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required /></label>
        <label className="field"><span>Emails per batch</span><input type="number" min={1} max={100} value={batchSize} onChange={(event) => setBatchSize(event.target.value)} required /></label>
        <label className="field"><span>Send every</span><div className="field-select"><select value={cadence} onChange={(event) => setCadence(event.target.value as "hour" | "day")}><option value="hour">Hour</option><option value="day">Day</option></select></div></label>
        <label className="field"><span>Location</span><div className="field-select"><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">All locations</option>{(locations.data ?? []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div></label>
        <label className="field"><span>Department</span><div className="field-select"><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">All departments</option>{(departments.data ?? []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div></label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button>
        <Button className="button-dark" disabled={submitting}>{submitting ? "Starting…" : "Queue check"}</Button>
      </div>
    </form>
  );
}

function CustodyDetail({ checkId, canManage, onClose }: { checkId: string; canManage: boolean; onClose: () => void }) {
  const detail = useGetCustodyCheck(checkId);
  const sendBatch = useSendCustodyCheckBatch();
  const remind = useRemindCustodyCheck();
  const closeCheck = useUpdateCustodyCheck();
  const client = useQueryClient();
  const { toast } = useToast();
  const check = detail.data;
  const [previewLinks, setPreviewLinks] = useState<{ email: string; href: string }[]>([]);

  async function run(label: string, task: () => Promise<unknown>) {
    try {
      const result = await task();
      await client.invalidateQueries();
      if (result && typeof result === "object" && "previewLinks" in result) {
        const links = (result as { previewLinks: { email: string; href: string }[] }).previewLinks;
        setPreviewLinks(links);
        if (links.length) {
          toast({ title: label, description: "Mail is off locally. Use the preview links in this check." });
          return;
        }
      }
      toast({ title: label });
    } catch (err) {
      toast({ title: "Could not update this check", description: apiErrorMessage(err, "Try again."), variant: "destructive" });
    }
  }

  return (
    <Modal title={check?.title ?? "Custody check"} onClose={onClose}>
      {detail.isLoading || !check ? <LoadingBlock /> : (
        <div className="asset-form">
          <p className="modal-intro">
            {check.sentCount} sent · {check.queuedCount} queued · {check.confirmedCount} confirmed · {check.deniedCount} missing
            {check.blockedCount ? ` · ${check.blockedCount} blocked (no email or failed send)` : ""}
          </p>
          <div className="directory-list">
            {check.recipients.map((recipient) => (
              <div className="directory-row lookup-row" key={recipient.id}>
                <div>
                  <b>{recipient.personName}</b>
                  <small>
                    {recipient.email || "No email"} · {recipient.mailStatus.replaceAll("_", " ")}
                    {recipient.items.map((item) => ` · ${item.assetTag} ${item.response}`).join("")}
                  </small>
                </div>
              </div>
            ))}
          </div>
          {previewLinks.length > 0 && (
            <div className="custody-preview-links" data-testid="custody-preview-links">
              <p>Preview links (mail skipped)</p>
              {previewLinks.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.email}</a>
              ))}
            </div>
          )}
          {canManage && check.status === "open" && (
            <div className="modal-actions">
              <Button type="button" className="button-ghost" data-testid="button-send-custody-batch" disabled={sendBatch.isPending} onClick={() => void run("Batch sent", () => sendBatch.mutateAsync({ checkId }))}>Send next batch</Button>
              <Button type="button" className="button-ghost" disabled={remind.isPending} onClick={() => void run("Pending people re-queued", () => remind.mutateAsync({ checkId }))}>Remind waiting</Button>
              <Button type="button" className="button-dark" disabled={closeCheck.isPending} onClick={() => { if (!window.confirm("Close this check? Confirmation links will stop working.")) return; void run("Check closed", () => closeCheck.mutateAsync({ checkId, data: { status: "closed" } })); }}>Close check</Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
