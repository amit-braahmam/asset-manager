import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
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
  FileUp,
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
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useRoute } from "wouter";
import type {
  Asset,
  AssetCondition,
  AssetDetail,
  AssetInput,
  AssetStatus,
  AssetUpdate,
  ActivityEvent,
  Location,
  LocationInput,
  LocationUpdate,
  MaintenanceItem,
  MaintenanceInput,
  MaintenanceUpdate,
  Person,
  PersonInput,
  PersonUpdate,
} from "@workspace/api-client-react";
import {
  useAssignAsset,
  useBulkUpdateAssetStatus,
  useCreateAsset,
  useCreateLocation,
  useCreateMaintenance,
  useCreatePerson,
  useDeleteMaintenance,
  useGetAsset,
  useGetDashboardActivity,
  useGetDashboardMaintenance,
  useGetDashboardSummary,
  useListAssets,
  useListLocations,
  useListMaintenance,
  useListPeople,
  useReturnAsset,
  useUpdateLocation,
  useUpdateMaintenance,
  useUpdatePerson,
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
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#2f7f78",
    colorForeground: "#172b35",
    colorMutedForeground: "#62727a",
    colorDanger: "#b94738",
    colorBackground: "#fffdf8",
    colorInput: "#fffdf8",
    colorInputForeground: "#172b35",
    colorNeutral: "#ded8ce",
    fontFamily: "Manrope, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#172b35] font-extrabold",
    headerSubtitle: "text-[#62727a]",
    socialButtonsBlockButtonText: "text-[#172b35]",
    formFieldLabel: "text-[#172b35]",
    footerActionLink: "text-[#2f7f78] font-bold",
    footerActionText: "text-[#62727a]",
    dividerText: "text-[#62727a]",
    identityPreviewEditButton: "text-[#2f7f78]",
    formFieldSuccessText: "text-[#2f7f78]",
    alertText: "text-[#b94738]",
    logoBox: "rounded-xl overflow-hidden",
    logoImage: "rounded-xl",
    socialButtonsBlockButton: "border-[#ded8ce] bg-[#fffdf8]",
    formButtonPrimary: "bg-[#2f7f78] hover:bg-[#256b65] text-[#fffdf8]",
    formFieldInput: "border-[#ded8ce] bg-[#fffdf8] text-[#172b35]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#ded8ce]",
    alert: "border-[#efc6bd] bg-[#fff1ee]",
    otpCodeFieldInput: "border-[#ded8ce] bg-[#fffdf8] text-[#172b35]",
    formFieldRow: "text-[#172b35]",
    main: "bg-transparent",
  },
};

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
  const [activityAction, setActivityAction] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const activity = useGetDashboardActivity({
    limit: 6,
    action: (activityAction || undefined) as ActivityEvent["type"] | undefined,
    search: activitySearch || undefined,
  });
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
            <div className="activity-filters">
              <input value={activitySearch} onChange={(event) => setActivitySearch(event.target.value)} placeholder="Search activity…" aria-label="Search activity" />
              <select value={activityAction} onChange={(event) => setActivityAction(event.target.value)} aria-label="Filter activity type">
                <option value="">All activity</option><option value="assignment">Assignments</option><option value="return">Returns</option><option value="maintenance">Maintenance</option><option value="update">Updates</option><option value="import">Imports</option><option value="alert">Alerts</option>
              </select>
            </div>
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
  const [bulkStatus, setBulkStatus] = useState<AssetStatus>("available");
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
  const bulkUpdate = useBulkUpdateAssetStatus();
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

  async function handleBulkStatus() {
    if (!selected.length) return;
    await bulkUpdate.mutateAsync({ data: { assetIds: selected, status: bulkStatus } });
    setSelected([]);
    await client.invalidateQueries();
    toast({ title: `${selected.length} assets updated` });
  }

  function exportCsv() {
    const headers = ["assetTag", "name", "category", "manufacturer", "model", "serialNumber", "status", "condition", "location"];
    const rows = items.map((asset) => [asset.assetTag, asset.name, asset.category, asset.manufacturer, asset.model, asset.serialNumber, asset.status, asset.condition, asset.location.name]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "asset-inventory.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Inventory CSV exported" });
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      toast({ title: "CSV has no asset rows", variant: "destructive" });
      return;
    }
    const headers = lines[0].split(",").map((header) => header.trim().replace(/^"|"$/g, ""));
    const records = lines.slice(1).map((line) => {
      const values = line.split(",").map((value) => value.trim().replace(/^"|"$/g, "").replaceAll('""', '"'));
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
    const fallbackLocation = locations.data?.[0]?.id;
    if (!fallbackLocation) {
      toast({ title: "Add a location before importing assets", variant: "destructive" });
      return;
    }
    let imported = 0;
    for (const record of records) {
      if (!record.assetTag || !record.name || !record.manufacturer || !record.model || !record.serialNumber) continue;
      await create.mutateAsync({ data: {
        assetTag: record.assetTag,
        name: record.name,
        category: record.category || "Peripheral",
        manufacturer: record.manufacturer,
        model: record.model,
        serialNumber: record.serialNumber,
        status: (record.status || "available") as AssetStatus,
        condition: (record.condition || "good") as AssetCondition,
        locationId: record.locationId || fallbackLocation,
        warrantyEnd: record.warrantyEnd || null,
        purchaseDate: record.purchaseDate || null,
        purchaseCost: record.purchaseCost ? Number(record.purchaseCost) : null,
        notes: record.notes || "",
      } });
      imported++;
    }
    await client.invalidateQueries();
    toast({ title: `${imported} assets imported` });
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
        <div className="inventory-summary"><div><span className="eyebrow">Asset register</span><strong>{assets.data?.total ?? "—"} records</strong>{selected.length > 0 && <span className="selection-count">{selected.length} selected</span>}</div><div className="inventory-actions"><label className="text-button file-button"><FileUp size={14} /> Import CSV<input type="file" accept=".csv,text/csv" onChange={(event) => void importCsv(event)} /></label><button className="text-button" onClick={exportCsv}><Download size={14} /> Export CSV</button></div></div>
        {selected.length > 0 && <div className="bulk-toolbar"><span className="eyebrow">Bulk action</span><span>{selected.length} selected</span><SelectField value={bulkStatus} onChange={(value) => setBulkStatus(value as AssetStatus)} options={statusOptions} label="Set status" testId="select-bulk-status" /><Button className="button-dark" onClick={() => void handleBulkStatus()} disabled={bulkUpdate.isPending}>{bulkUpdate.isPending ? "Updating…" : "Apply status"}</Button><button className="text-button" onClick={() => setSelected([])}>Clear</button></div>}
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
  const peopleQuery = useListPeople();
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
      {modal === "assign" && <AssignModal people={peopleQuery.data ?? people} locations={locations.data ?? []} currentLocation={data.location.id} onClose={() => setModal(null)} onSubmit={assignAsset} submitting={assign.isPending} />}
      {modal === "status" && <StatusModal current={data.status} onClose={() => setModal(null)} onSubmit={changeStatus} submitting={statusMutation.isPending} />}
    </ShellPage>
  );
}

function InfoRow({ icon: Icon, label, value, secondary, mono = false }: { icon: typeof Boxes; label: string; value: string; secondary?: string; mono?: boolean }) {
  return <div className="info-row"><span className="info-icon"><Icon size={15} /></span><div><small>{label}</small><b className={mono ? "mono" : ""}>{value}</b>{secondary && <em>{secondary}</em>}</div></div>;
}

function AssignModal({ people: availablePeople, locations, currentLocation, onClose, onSubmit, submitting }: { people: Person[]; locations: Location[]; currentLocation: string; onClose: () => void; onSubmit: (personId: string, locationId: string) => Promise<void>; submitting: boolean }) {
  const [personId, setPersonId] = useState(availablePeople[0]?.id ?? "");
  const [locationId, setLocationId] = useState(currentLocation || locations[0]?.id || "");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try { await onSubmit(personId, locationId); } catch (err) { setError(err instanceof Error ? err.message : "Unable to assign this asset."); }
  }
  return <Modal title="Assign asset" onClose={onClose}><form className="asset-form" onSubmit={submit}><p className="modal-intro">Record who has custody of this asset and where it is operating.</p><Field label="Person" value={personId} onChange={setPersonId} options={availablePeople.map((person) => ({ value: person.id, label: `${person.name} · ${person.department}` }))} /><Field label="Location" value={locationId} onChange={setLocationId} options={locations.map((location) => ({ value: location.id, label: location.name }))} />{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-dark" disabled={submitting || !personId}>{submitting ? "Assigning…" : "Confirm assignment"}</Button></div></form></Modal>;
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

type DirectoryModal = { kind: "person" | "location"; id?: string } | null;

function Directory() {
  const peopleQuery = useListPeople();
  const locationsQuery = useListLocations();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const client = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<DirectoryModal>(null);

  async function savePerson(values: { name: string; department: string; email: string }) {
    if (modal?.kind === "person" && modal.id) await updatePerson.mutateAsync({ personId: modal.id, data: values as PersonUpdate });
    else await createPerson.mutateAsync({ data: values as PersonInput });
    setModal(null);
    await client.invalidateQueries();
    toast({ title: modal?.id ? "Person updated" : "Person added" });
  }

  async function saveLocation(values: { name: string; city: string }) {
    if (modal?.kind === "location" && modal.id) await updateLocation.mutateAsync({ locationId: modal.id, data: values as LocationUpdate });
    else await createLocation.mutateAsync({ data: values as LocationInput });
    setModal(null);
    await client.invalidateQueries();
    toast({ title: modal?.id ? "Location updated" : "Location added" });
  }

  const editingPerson = modal?.kind === "person" ? peopleQuery.data?.find((person) => person.id === modal.id) : undefined;
  const editingLocation = modal?.kind === "location" ? locationsQuery.data?.find((location) => location.id === modal.id) : undefined;
  return <ShellPage>
    <Topbar title="Directory" description="Keep custodians and operating locations current for clean assignments." action={<div className="topbar-button-row"><Button className="button-ghost" onClick={() => setModal({ kind: "location" })}><MapPin size={15} /> Add location</Button><Button className="button-accent" onClick={() => setModal({ kind: "person" })}><Plus size={16} /> Add person</Button></div>} />
    <div className="page-wrap">
      <div className="directory-grid">
        <Card><SectionHeading eyebrow="Custodians" title="People" detail={`${peopleQuery.data?.length ?? "—"} people available for assignment.`} /><div className="directory-list">{peopleQuery.isLoading ? <LoadingBlock /> : peopleQuery.data?.length ? peopleQuery.data.map((person) => <div className="directory-row" key={person.id}><div className="avatar">{initials(person.name)}</div><div><b>{person.name}</b><small>{person.department} · {person.email}</small></div><button className="row-arrow" aria-label={`Edit ${person.name}`} onClick={() => setModal({ kind: "person", id: person.id })}><Pencil size={14} /></button></div>) : <EmptyState title="No people yet" text="Add a person to make assignment available." />}</div></Card>
        <Card><SectionHeading eyebrow="Operating footprint" title="Locations" detail={`${locationsQuery.data?.length ?? "—"} sites in the register.`} /><div className="directory-list">{locationsQuery.isLoading ? <LoadingBlock /> : locationsQuery.data?.length ? locationsQuery.data.map((location) => <div className="directory-row" key={location.id}><div className="avatar location-avatar"><MapPin size={15} /></div><div><b>{location.name}</b><small>{location.city} · {location.assetCount} assets</small></div><button className="row-arrow" aria-label={`Edit ${location.name}`} onClick={() => setModal({ kind: "location", id: location.id })}><Pencil size={14} /></button></div>) : <EmptyState title="No locations yet" text="Add a location before registering assets." />}</div></Card>
      </div>
    </div>
    {modal?.kind === "person" && <Modal title={editingPerson ? "Edit person" : "Add person"} onClose={() => setModal(null)}><DirectoryForm kind="person" initial={editingPerson} onSubmit={savePerson} onCancel={() => setModal(null)} submitting={createPerson.isPending || updatePerson.isPending} /></Modal>}
    {modal?.kind === "location" && <Modal title={editingLocation ? "Edit location" : "Add location"} onClose={() => setModal(null)}><DirectoryForm kind="location" initial={editingLocation} onSubmit={saveLocation} onCancel={() => setModal(null)} submitting={createLocation.isPending || updateLocation.isPending} /></Modal>}
  </ShellPage>;
}

function DirectoryForm({ kind, initial, onSubmit, onCancel, submitting }: { kind: "person" | "location"; initial?: Partial<Person & Location>; onSubmit: (values: { name: string; department: string; email: string } | { name: string; city: string }) => Promise<void>; onCancel: () => void; submitting: boolean }) {
  const [values, setValues] = useState<{ name: string; department: string; email: string; city: string }>({ name: initial?.name ?? "", department: initial?.department ?? "", email: initial?.email ?? "", city: initial?.city ?? "" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit(kind === "person" ? { name: values.name, department: values.department, email: values.email } : { name: values.name, city: values.city }); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save this record."); }
  }
  return <form className="asset-form" onSubmit={submit}><div className="form-grid"><Field label="Name" value={values.name} onChange={(value) => setValues((current) => ({ ...current, name: value }))} required />{kind === "person" ? <><Field label="Department" value={values.department} onChange={(value) => setValues((current) => ({ ...current, department: value }))} placeholder="Operations" required /><Field label="Email" value={values.email} onChange={(value) => setValues((current) => ({ ...current, email: value }))} type="email" required /></> : <Field label="City / region" value={values.city} onChange={(value) => setValues((current) => ({ ...current, city: value }))} placeholder="Bengaluru" required />}</div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button><Button className="button-dark" disabled={submitting}>{submitting ? "Saving…" : "Save record"}</Button></div></form>;
}

function Maintenance() {
  const maintenance = useListMaintenance({ limit: 50 });
  const assets = useListAssets({ page: 1, pageSize: 100 });
  const create = useCreateMaintenance();
  const update = useUpdateMaintenance();
  const remove = useDeleteMaintenance();
  const client = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function save(values: { assetId: string; scheduledAt: string; technician: string; priority: string; status: string }) {
    const data = { ...values, priority: values.priority as MaintenanceInput["priority"], status: values.status as MaintenanceInput["status"], scheduledAt: new Date(values.scheduledAt).toISOString() };
    if (editing) await update.mutateAsync({ maintenanceId: editing.id, data: data as MaintenanceUpdate });
    else await create.mutateAsync({ data: data as MaintenanceInput });
    setEditing(null);
    setShowForm(false);
    await client.invalidateQueries();
    toast({ title: editing ? "Maintenance updated" : "Maintenance scheduled" });
  }

  async function deleteItem(item: MaintenanceItem) {
    if (!window.confirm(`Remove maintenance for ${item.assetTag}?`)) return;
    await remove.mutateAsync({ maintenanceId: item.id });
    await client.invalidateQueries();
    toast({ title: "Maintenance item removed" });
  }

  return <ShellPage><Topbar title="Maintenance" description="Keep service work visible before it becomes a business interruption." action={<Button className="button-accent" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Schedule work</Button>} /><div className="page-wrap"><div className="maintenance-header"><div className="queue-summary"><span className="queue-number">{maintenance.data?.length ?? "—"}</span><div><b>Open service items</b><small>Sorted by scheduled date</small></div></div><div className="legend"><span><i className="legend-dot high" /> High priority</span><span><i className="legend-dot normal" /> Planned</span></div></div><Card className="maintenance-page-card">{maintenance.isLoading ? <div className="stack-skeleton"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : maintenance.isError ? <ErrorState onRetry={() => void maintenance.refetch()} /> : maintenance.data?.length ? <MaintenanceList items={maintenance.data} onEdit={(item) => { setEditing(item); setShowForm(true); }} onDelete={(item) => void deleteItem(item)} /> : <EmptyState title="Maintenance queue is clear" text="Nothing is scheduled for the next 14 days." />}</Card><Card className="maintenance-note"><Wrench size={18} /><div><b>Maintenance control</b><p>Schedule, reprioritize, complete, or remove service work without leaving the asset register.</p></div></Card></div>{showForm && <Modal title={editing ? "Edit maintenance" : "Schedule maintenance"} onClose={() => { setEditing(null); setShowForm(false); }}><MaintenanceForm assets={assets.data?.items ?? []} initial={editing} editing={Boolean(editing)} onSubmit={save} onCancel={() => { setEditing(null); setShowForm(false); }} submitting={create.isPending || update.isPending} /></Modal>}</ShellPage>;
}

function MaintenanceForm({ assets, initial, editing, onSubmit, onCancel, submitting }: { assets: Asset[]; initial?: MaintenanceItem | null; editing: boolean; onSubmit: (values: { assetId: string; scheduledAt: string; technician: string; priority: string; status: string }) => Promise<void>; onCancel: () => void; submitting: boolean }) {
  const [values, setValues] = useState<{ assetId: string; scheduledAt: string; technician: string; priority: string; status: string }>({ assetId: initial ? assets.find((asset) => asset.assetTag === initial.assetTag)?.id ?? "" : assets[0]?.id ?? "", scheduledAt: initial ? new Date(initial.scheduledAt).toISOString().slice(0, 16) : "", technician: initial?.technician ?? "", priority: initial?.priority ?? "normal", status: initial?.status ?? "scheduled" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit(values); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save maintenance."); }
  }
  return <form className="asset-form" onSubmit={submit}><p className="modal-intro">Record the next service action and keep the technician accountable.</p><div className="form-grid"><Field label="Asset" value={values.assetId} onChange={(value) => setValues((current) => ({ ...current, assetId: value }))} options={assets.map((asset) => ({ value: asset.id, label: `${asset.assetTag} · ${asset.name}` }))} required /><Field label="Scheduled at" value={values.scheduledAt} onChange={(value) => setValues((current) => ({ ...current, scheduledAt: value }))} type="datetime-local" required /><Field label="Technician" value={values.technician} onChange={(value) => setValues((current) => ({ ...current, technician: value }))} placeholder="Name or team" required /><Field label="Priority" value={values.priority} onChange={(value) => setValues((current) => ({ ...current, priority: value }))} options={[{ value: "high", label: "High" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }]} /><Field label="Status" value={values.status} onChange={(value) => setValues((current) => ({ ...current, status: value }))} options={[{ value: "pending", label: "Pending" }, { value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }, { value: "overdue", label: "Overdue" }]} /></div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button><Button className="button-dark" disabled={submitting || !values.assetId}>{submitting ? "Saving…" : editing ? "Save changes" : "Schedule work"}</Button></div></form>;
}

function NotFound() {
  return <ShellPage><Topbar title="Page not found" /><div className="page-wrap"><EmptyState title="That view does not exist" text="Use the navigation to return to the operations console." /></div></ShellPage>;
}

function Landing() {
  return <div className="auth-landing noise"><header className="auth-landing-header"><Link href="/" className="brand"><span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.4} /></span><span className="brand-copy"><strong>asset<span>control</span></strong><small>OPERATIONS CONSOLE</small></span></Link><div className="auth-landing-actions"><Link href="/sign-in" className="button button-ghost">Sign in</Link><Link href="/sign-up" className="button button-accent">Create account</Link></div></header><main className="auth-landing-main"><div className="auth-kicker"><span className="health-dot" /> Asset operations, without the blind spots</div><h1>Know where every asset is. <em>Know what happens next.</em></h1><p>AssetControl gives growing operations teams one trusted register for inventory, people, locations, maintenance, and accountability.</p><div className="auth-landing-ctas"><Link href="/sign-up" className="button button-dark">Start your workspace <ArrowRight size={16} /></Link><Link href="/sign-in" className="text-link">Already have access? Sign in</Link></div><div className="auth-landing-proof"><span><Check size={15} /> Live asset register</span><span><Check size={15} /> Audit-ready activity</span><span><Check size={15} /> Maintenance visibility</span></div></main><div className="auth-landing-orbit orbit-one" /><div className="auth-landing-orbit orbit-two" /></div>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/workspace" /></Show><Show when="signed-out"><Landing /></Show></>;
}

function UserPortal() {
  return <><Show when="signed-in"><Switch><Route path="/workspace" component={Dashboard} /><Route path="/inventory">{() => <Inventory openCreate={new URLSearchParams(window.location.search).get("new") === "1"} />}</Route><Route path="/assets/:assetId" component={AssetDetailPage} /><Route path="/maintenance" component={Maintenance} /><Route path="/directory" component={Directory} /><Route component={NotFound} /></Switch></Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function SignInPage() {
  return <div className="auth-page"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="auth-page"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) queryClient.clear();
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: "Welcome back", subtitle: "Sign in to access your workspace" } }, signUp: { start: { title: "Create your workspace", subtitle: "Get started with AssetControl" } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}><QueryClientProvider client={queryClient}><ClerkQueryClientCacheInvalidator /><Switch><Route path="/" component={HomeRedirect} /><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route path="/workspace" component={UserPortal} /><Route path="/inventory" component={UserPortal} /><Route path="/assets/:assetId" component={UserPortal} /><Route path="/maintenance" component={UserPortal} /><Route path="/directory" component={UserPortal} /><Route component={UserPortal} /></Switch><Toaster /></QueryClientProvider></ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;