import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Command,
  Download,
  LayoutDashboard,
  MapPin,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Link, Route, Switch, useLocation, useRoute } from "wouter";
import type {
  Asset,
  AssetCondition,
  AssetDetail,
  AssetInput,
  AssetStatus,
  AssetUpdate,
  Location,
  Person,
} from "@workspace/api-client-react";
import {
  useAssignAsset,
  useCreateAsset,
  useGetAsset,
  useGetDashboardActivity,
  useGetDashboardMaintenance,
  useGetDashboardSummary,
  useListAssets,
  useListLocations,
  useListMaintenance,
  useReturnAsset,
  useUpdateAsset,
  useUpdateAssetStatus,
} from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  ActivityList,
  AppShell,
  AssetTable,
  Button,
  Card,
  EmptyState,
  ErrorState,
  formatDate,
  formatMoney,
  formatRelative,
  LoadingBlock,
  MaintenanceList,
  MetricCard,
  Modal,
  Pagination,
  SearchBox,
  SelectField,
  Sidebar,
  Skeleton,
  StatusPill,
  Topbar,
} from "@/components/asset-ui";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true } },
});

const statusOptions = [
  { value: "available", label: "Available" },
  { value: "assigned", label: "Assigned" },
  { value: "in_repair", label: "In repair" },
  { value: "rma", label: "RMA" },
  { value: "retired", label: "Retired" },
  { value: "lost", label: "Lost" },
];
const conditionOptions = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];
const people: Person[] = [
  { id: "person-sarah", name: "Sarah Johnson", department: "Operations", email: "sarah.johnson@example.com" },
  { id: "person-daniel", name: "Daniel Smith", department: "Finance", email: "daniel.smith@example.com" },
  { id: "person-priya", name: "Priya Nair", department: "Engineering", email: "priya.nair@example.com" },
  { id: "person-marcus", name: "Marcus Lee", department: "Sales", email: "marcus.lee@example.com" },
];
const categories = ["Laptop", "Monitor", "Server", "Peripheral", "Mobile", "Networking"];

type FormValues = {
  assetTag: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: AssetStatus;
  condition: AssetCondition;
  locationId: string;
  warrantyEnd: string;
  purchaseDate: string;
  purchaseCost: string;
  notes: string;
};

const blankForm: FormValues = {
  assetTag: "",
  name: "",
  category: "Laptop",
  manufacturer: "",
  model: "",
  serialNumber: "",
  status: "available",
  condition: "good",
  locationId: "",
  warrantyEnd: "",
  purchaseDate: "",
  purchaseCost: "",
  notes: "",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ShellPage({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function Dashboard() {
  const summary = useGetDashboardSummary();
  const activity = useGetDashboardActivity({ limit: 6 });
  const maintenance = useGetDashboardMaintenance({ limit: 4 });
  const [, setLocation] = useLocation();

  if (summary.isLoading) return <ShellPage><Topbar title="Overview" description="A live pulse of your company’s equipment estate." /><div className="page-wrap"><LoadingBlock /></div></ShellPage>;
  if (summary.isError || !summary.data) {
    return <ShellPage><Topbar title="Overview" description="A live pulse of your company’s equipment estate." /><div className="page-wrap"><ErrorState onRetry={() => void summary.refetch()} /></div></ShellPage>;
  }

  const data = summary.data;
  return (
    <ShellPage>
      <Topbar
        title="Overview"
        description="A live pulse of your company’s equipment estate."
        action={<Button className="button-accent" onClick={() => setLocation("/inventory?new=1")}><Plus size={16} /> Add asset</Button>}
      />
      <div className="page-wrap">
        <div className="status-strip"><span className="pulse-dot" /> Live inventory sync <span className="strip-divider" /> Last refresh just now <button onClick={() => { void summary.refetch(); void activity.refetch(); void maintenance.refetch(); }}><RefreshCw size={13} /> Refresh</button></div>
        <div className="metric-grid fade-up">
          <MetricCard label="Total assets" value={data.total} detail="Across all locations" tone="teal" icon={Boxes} />
          <MetricCard label="Assigned" value={data.assigned} detail={`${data.utilization}% utilization`} tone="blue" icon={Users} />
          <MetricCard label="In repair" value={data.inRepair} detail="Needs attention" tone="orange" icon={Wrench} />
          <MetricCard label="Available" value={data.available} detail="Ready to deploy" tone="violet" icon={ClipboardCheck} />
        </div>
        <div className="dashboard-grid">
          <Card className="activity-card fade-up delay-1">
            <SectionHeading eyebrow="Recent activity" title="Operational feed" detail="The latest changes across your estate." action={<button className="text-button" onClick={() => setLocation("/inventory")}>View inventory <ArrowRight size={14} /></button>} />
            {activity.isLoading ? <div className="stack-skeleton"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : activity.isError ? <ErrorState onRetry={() => void activity.refetch()} /> : activity.data?.length ? <ActivityList events={activity.data} /> : <EmptyState />}
          </Card>
          <Card className="maintenance-card fade-up delay-2">
            <SectionHeading eyebrow="Next 14 days" title="Maintenance queue" detail="Planned work and open service tasks." action={<Link href="/maintenance" className="text-button">Open queue <ArrowRight size={14} /></Link>} />
            {maintenance.isLoading ? <div className="stack-skeleton"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : maintenance.isError ? <ErrorState onRetry={() => void maintenance.refetch()} /> : maintenance.data?.length ? <MaintenanceList items={maintenance.data} /> : <EmptyState title="Queue is clear" text="No maintenance tasks are scheduled." />}
          </Card>
        </div>
        <Card className="quick-actions fade-up delay-3">
          <div><div className="eyebrow">Shortcuts</div><h3>Move work forward</h3></div>
          <div className="shortcut-grid">
            <button onClick={() => setLocation("/inventory?new=1")}><span><PackagePlus size={17} /></span><b>Add an asset</b><small>Register equipment into inventory</small></button>
            <button onClick={() => setLocation("/inventory")}><span><Search size={17} /></span><b>Find an asset</b><small>Search by tag, model, or serial</small></button>
            <button onClick={() => setLocation("/maintenance")}><span><Wrench size={17} /></span><b>Review maintenance</b><small>See what needs attention next</small></button>
          </div>
        </Card>
      </div>
    </ShellPage>
  );
}

function Inventory({ openCreate = false }: { openCreate?: boolean }) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [locationId, setLocationId] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(openCreate);
  const locations = useListLocations();
  const assets = useListAssets({
    search: search || undefined,
    status: (status || undefined) as AssetStatus | undefined,
    category: category || undefined,
    locationId: locationId || undefined,
    page,
    pageSize: 8,
  });
  const create = useCreateAsset();
  const client = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    setPage(1);
  }, [search, status, category, locationId]);

  const items = assets.data?.items ?? [];
  const categories = useMemo(() => Array.from(new Set(items.map((asset) => asset.category))).sort(), [items]);
  const locationOptions = (locations.data ?? []).map((location) => ({ value: location.id, label: location.name }));

  async function handleCreate(values: FormValues) {
    const body: AssetInput = {
      assetTag: values.assetTag,
      name: values.name,
      category: values.category,
      manufacturer: values.manufacturer,
      model: values.model,
      serialNumber: values.serialNumber,
      status: values.status,
      condition: values.condition,
      locationId: values.locationId,
      warrantyEnd: values.warrantyEnd || null,
      purchaseDate: values.purchaseDate || null,
      purchaseCost: values.purchaseCost ? Number(values.purchaseCost) : null,
      notes: values.notes,
    };
    await create.mutateAsync({ data: body });
    await client.invalidateQueries();
    setShowCreate(false);
    toast({ title: "Asset added to inventory" });
  }

  return (
    <ShellPage>
      <Topbar title="Inventory" description="Every device, peripheral, and system in one working view." action={<Button className="button-accent" onClick={() => setShowCreate(true)}><Plus size={16} /> Add asset</Button>} />
      <div className="page-wrap">
        <div className="inventory-toolbar">
          <SearchBox value={search} onChange={setSearch} />
          <SelectField value={status} onChange={setStatus} options={statusOptions} label="Status" testId="select-status" />
          <SelectField value={category} onChange={setCategory} options={(categories.length ? categories : ["Laptop", "Monitor", "Server", "Peripheral", "Mobile", "Networking"]).map((value) => ({ value, label: value }))} label="Category" testId="select-category" />
          <SelectField value={locationId} onChange={setLocationId} options={locationOptions} label="Location" testId="select-location" />
          <button className="filter-button" title="More filters"><SlidersHorizontal size={16} /> <span>Filters</span></button>
        </div>
        <div className="inventory-summary"><div><span className="eyebrow">Asset register</span><strong>{assets.data?.total ?? "—"} records</strong>{selected.length > 0 && <span className="selection-count">{selected.length} selected</span>}</div><button className="text-button"><Download size={14} /> Export CSV</button></div>
        <Card className="table-card">
          {assets.isLoading ? <div className="table-loading"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : assets.isError ? <ErrorState onRetry={() => void assets.refetch()} /> : items.length ? <AssetTable items={items} selected={selected} onSelect={(id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} /> : <EmptyState title="No matching assets" text="Try a different search or clear one of the filters." />}
          {assets.data && <Pagination page={assets.data.page} pageSize={assets.data.pageSize} total={assets.data.total} onPage={(next) => { setPage(next); setSelected([]); }} />}
        </Card>
      </div>
      {showCreate && <Modal title="Add asset" onClose={() => setShowCreate(false)}><AssetForm locations={locations.data ?? []} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} submitting={create.isPending} /></Modal>}
    </ShellPage>
  );
}

function AssetForm({
  locations,
  initial,
  editing = false,
  onSubmit,
  onCancel,
  submitting,
}: {
  locations: Location[];
  initial?: Partial<FormValues>;
  editing?: boolean;
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [values, setValues] = useState<FormValues>({ ...blankForm, locationId: locations[0]?.id ?? "", ...initial });
  const [error, setError] = useState("");
  function change(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit(values); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save this asset."); }
  }
  return (
    <form className="asset-form" onSubmit={submit}>
      <div className="form-grid">
        {!editing && <Field label="Asset tag" value={values.assetTag} onChange={(value) => change("assetTag", value)} placeholder="LT-1001" required />}
        <Field label="Asset name" value={values.name} onChange={(value) => change("name", value)} placeholder="MacBook Pro 14" required />
        <Field label="Category" value={values.category} onChange={(value) => change("category", value)} options={categories.map((value) => ({ value, label: value }))} />
        <Field label="Manufacturer" value={values.manufacturer} onChange={(value) => change("manufacturer", value)} placeholder="Apple" required />
        <Field label="Model" value={values.model} onChange={(value) => change("model", value)} placeholder="MacBook Pro M3" required />
        <Field label="Serial number" value={values.serialNumber} onChange={(value) => change("serialNumber", value)} placeholder="Serial / IMEI" required />
        <Field label="Condition" value={values.condition} onChange={(value) => change("condition", value)} options={conditionOptions} />
        <Field label="Location" value={values.locationId} onChange={(value) => change("locationId", value)} options={locations.map((location) => ({ value: location.id, label: location.name }))} />
        {!editing && <Field label="Status" value={values.status} onChange={(value) => change("status", value)} options={statusOptions} />}
        <Field label="Purchase cost" value={values.purchaseCost} onChange={(value) => change("purchaseCost", value)} placeholder="0.00" type="number" />
        <Field label="Purchase date" value={values.purchaseDate} onChange={(value) => change("purchaseDate", value)} type="date" />
        <Field label="Warranty end" value={values.warrantyEnd} onChange={(value) => change("warrantyEnd", value)} type="date" />
      </div>
      <label className="field field-full"><span>Notes</span><textarea value={values.notes} onChange={(event) => change("notes", event.target.value)} placeholder="Add useful context for the next operator…" rows={3} /></label>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button><Button className="button-dark" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save changes" : "Add asset"}</Button></div>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, options, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; options?: { value: string; label: string }[]; type?: string; required?: boolean }) {
  return <label className="field"><span>{label}</span>{options ? <div className="field-select"><select value={value} onChange={(event) => onChange(event.target.value)} required={required}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={14} /></div> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />}</label>;
}

function AssetDetailPage() {
  const [, params] = useRoute("/assets/:assetId");
  const [, setLocation] = useLocation();
  const assetId = params?.assetId ?? "";
  const asset = useGetAsset(assetId);
  const locations = useListLocations();
  const update = useUpdateAsset();
  const assign = useAssignAsset();
  const returnMutation = useReturnAsset();
  const statusMutation = useUpdateAssetStatus();
  const client = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<"edit" | "assign" | "status" | null>(null);

  if (asset.isLoading) return <ShellPage><Topbar title="Asset detail" /><div className="page-wrap"><LoadingBlock /></div></ShellPage>;
  if (asset.isError || !asset.data) return <ShellPage><Topbar title="Asset detail" /><div className="page-wrap"><ErrorState message="This asset could not be found." onRetry={() => void asset.refetch()} /></div></ShellPage>;
  const data = asset.data;
  async function refresh(message: string) {
    await client.invalidateQueries();
    toast({ title: message });
  }
  async function saveEdit(values: FormValues) {
    const body: AssetUpdate = {
      name: values.name,
      category: values.category,
      manufacturer: values.manufacturer,
      model: values.model,
      serialNumber: values.serialNumber,
      condition: values.condition,
      locationId: values.locationId,
      warrantyEnd: values.warrantyEnd || null,
      purchaseDate: values.purchaseDate || null,
      purchaseCost: values.purchaseCost ? Number(values.purchaseCost) : null,
      notes: values.notes,
    };
    await update.mutateAsync({ assetId, data: body });
    setModal(null);
    await refresh("Asset details updated");
  }
  async function assignAsset(personId: string, newLocationId: string) {
    await assign.mutateAsync({ assetId, data: { personId, locationId: newLocationId } });
    setModal(null);
    await refresh("Asset assigned");
  }
  async function returnAsset() {
    await returnMutation.mutateAsync({ assetId });
    await refresh("Asset returned to available stock");
  }
  async function changeStatus(nextStatus: AssetStatus, note: string) {
    await statusMutation.mutateAsync({ assetId, data: { status: nextStatus, note: note || undefined } });
    setModal(null);
    await refresh("Asset status updated");
  }
  const initial: Partial<FormValues> = {
    assetTag: data.assetTag,
    name: data.name,
    category: data.category,
    manufacturer: data.manufacturer,
    model: data.model,
    serialNumber: data.serialNumber,
    condition: data.condition,
    locationId: data.location.id,
    warrantyEnd: data.warrantyEnd ?? "",
    purchaseDate: data.purchaseDate ?? "",
    purchaseCost: data.purchaseCost?.toString() ?? "",
    notes: data.notes,
  };
  return (
    <ShellPage>
      <Topbar title={data.name} description={`${data.assetTag} · ${data.category}`} action={<Button className="button-ghost" onClick={() => setModal("edit")}><Pencil size={15} /> Edit asset</Button>} />
      <div className="page-wrap">
        <button className="back-link" onClick={() => setLocation("/inventory")}><ArrowLeft size={15} /> Back to inventory</button>
        <div className="detail-hero">
          <div className="detail-icon">{data.category.slice(0, 1)}</div>
          <div><div className="eyebrow mono">{data.assetTag}</div><h2>{data.name}</h2><p>{data.manufacturer} {data.model} <span className="dot-separator" /> Serial {data.serialNumber}</p></div>
          <div className="detail-hero-status"><StatusPill status={data.status} /><span className="muted mono">Updated {formatRelative(data.lastUpdated)}</span></div>
        </div>
        <div className="detail-actions">
          {data.assignee ? <Button className="button-dark" onClick={() => void returnAsset()} disabled={returnMutation.isPending}><RotateCcw size={15} /> {returnMutation.isPending ? "Returning…" : "Return asset"}</Button> : <Button className="button-accent" onClick={() => setModal("assign")}><UserRound size={15} /> Assign asset</Button>}
          <Button className="button-ghost" onClick={() => setModal("status")}><SlidersHorizontal size={15} /> Change status</Button>
        </div>
        <div className="detail-grid">
          <Card><SectionHeading eyebrow="At a glance" title="Ownership & location" /><div className="detail-list"><InfoRow icon={UserRound} label="Assigned to" value={data.assignee?.name ?? "Available in inventory"} secondary={data.assignee?.department} /><InfoRow icon={MapPin} label="Current location" value={data.location.name} secondary={data.location.city} /><InfoRow icon={ClipboardCheck} label="Condition" value={data.condition[0].toUpperCase() + data.condition.slice(1)} /><InfoRow icon={Clock3} label="Warranty end" value={formatDate(data.warrantyEnd)} /></div></Card>
          <Card><SectionHeading eyebrow="Purchase record" title="Financial details" /><div className="detail-list"><InfoRow icon={PackagePlus} label="Purchase cost" value={formatMoney(data.purchaseCost)} /><InfoRow icon={Clock3} label="Purchase date" value={formatDate(data.purchaseDate)} /><InfoRow icon={ShieldCheck} label="Serial number" value={data.serialNumber} mono /><InfoRow icon={Boxes} label="Asset category" value={data.category} /></div></Card>
        </div>
        <div className="detail-grid lower">
          <Card><SectionHeading eyebrow="Technical profile" title="Specifications" />{Object.keys(data.specifications).length ? <div className="spec-grid">{Object.entries(data.specifications).map(([key, value]) => <div key={key}><span>{key}</span><b>{value}</b></div>)}</div> : <EmptyState title="No specifications" text="Add technical context when editing this asset." />}{data.notes && <div className="notes-box"><span className="eyebrow">Operator notes</span><p>{data.notes}</p></div>}</Card>
          <Card><SectionHeading eyebrow="Audit trail" title="Recent history" />{data.history.length ? <div className="history-list">{data.history.map((event) => <div className="history-row" key={event.id}><span className="history-dot" /><div><b>{event.detail}</b><small>{event.actor} · {formatRelative(event.createdAt)}</small></div></div>)}</div> : <EmptyState title="No activity yet" />}</Card>
        </div>
      </div>
      {modal === "edit" && <Modal title="Edit asset" onClose={() => setModal(null)}><AssetForm locations={locations.data ?? []} initial={initial} editing onSubmit={saveEdit} onCancel={() => setModal(null)} submitting={update.isPending} /></Modal>}
      {modal === "assign" && <AssignModal locations={locations.data ?? []} currentLocation={data.location.id} onClose={() => setModal(null)} onSubmit={assignAsset} submitting={assign.isPending} />}
      {modal === "status" && <StatusModal current={data.status} onClose={() => setModal(null)} onSubmit={changeStatus} submitting={statusMutation.isPending} />}
    </ShellPage>
  );
}

function InfoRow({ icon: Icon, label, value, secondary, mono = false }: { icon: typeof Boxes; label: string; value: string; secondary?: string; mono?: boolean }) {
  return <div className="info-row"><span className="info-icon"><Icon size={15} /></span><div><small>{label}</small><b className={mono ? "mono" : ""}>{value}</b>{secondary && <em>{secondary}</em>}</div></div>;
}

function AssignModal({ locations, currentLocation, onClose, onSubmit, submitting }: { locations: Location[]; currentLocation: string; onClose: () => void; onSubmit: (personId: string, locationId: string) => Promise<void>; submitting: boolean }) {
  const [personId, setPersonId] = useState(people[0].id);
  const [locationId, setLocationId] = useState(currentLocation || locations[0]?.id || "");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try { await onSubmit(personId, locationId); } catch (err) { setError(err instanceof Error ? err.message : "Unable to assign this asset."); }
  }
  return <Modal title="Assign asset" onClose={onClose}><form className="asset-form" onSubmit={submit}><p className="modal-intro">Record who has custody of this asset and where it is operating.</p><Field label="Person" value={personId} onChange={setPersonId} options={people.map((person) => ({ value: person.id, label: `${person.name} · ${person.department}` }))} /><Field label="Location" value={locationId} onChange={setLocationId} options={locations.map((location) => ({ value: location.id, label: location.name }))} />{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-dark" disabled={submitting}>{submitting ? "Assigning…" : "Confirm assignment"}</Button></div></form></Modal>;
}

function StatusModal({ current, onClose, onSubmit, submitting }: { current: AssetStatus; onClose: () => void; onSubmit: (status: AssetStatus, note: string) => Promise<void>; submitting: boolean }) {
  const [status, setStatus] = useState<AssetStatus>(current);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try { await onSubmit(status, note); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update status."); }
  }
  return <Modal title="Change status" onClose={onClose}><form className="asset-form" onSubmit={submit}><p className="modal-intro">Status changes are added to the asset’s audit trail.</p><Field label="New status" value={status} onChange={(value) => setStatus(value as AssetStatus)} options={statusOptions} /><label className="field field-full"><span>Reason or note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why is this status changing?" rows={3} /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-dark" disabled={submitting}>{submitting ? "Updating…" : "Update status"}</Button></div></form></Modal>;
}

function Maintenance() {
  const maintenance = useListMaintenance({ limit: 50 });
  return <ShellPage><Topbar title="Maintenance" description="Keep service work visible before it becomes a business interruption." /><div className="page-wrap"><div className="maintenance-header"><div className="queue-summary"><span className="queue-number">{maintenance.data?.length ?? "—"}</span><div><b>Open service items</b><small>Sorted by scheduled date</small></div></div><div className="legend"><span><i className="legend-dot high" /> High priority</span><span><i className="legend-dot normal" /> Planned</span></div></div><Card className="maintenance-page-card">{maintenance.isLoading ? <div className="stack-skeleton"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : maintenance.isError ? <ErrorState onRetry={() => void maintenance.refetch()} /> : maintenance.data?.length ? <MaintenanceList items={maintenance.data} /> : <EmptyState title="Maintenance queue is clear" text="Nothing is scheduled for the next 14 days." />}</Card><Card className="maintenance-note"><Wrench size={18} /><div><b>Maintenance preview</b><p>Scheduling, technician assignment, and completion tracking are ready for the next milestone.</p></div></Card></div></ShellPage>;
}

function NotFound() {
  return <ShellPage><Topbar title="Page not found" /><div className="page-wrap"><EmptyState title="That view does not exist" text="Use the navigation to return to the operations console." /></div></ShellPage>;
}

function Router() {
  return <Switch><Route path="/" component={Dashboard} /><Route path="/inventory">{() => <Inventory openCreate={new URLSearchParams(window.location.search).get("new") === "1"} />}</Route><Route path="/assets/:assetId" component={AssetDetailPage} /><Route path="/maintenance" component={Maintenance} /><Route component={NotFound} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><ErrorBoundary><Router /></ErrorBoundary><Toaster /></QueryClientProvider>;
}

export default App;