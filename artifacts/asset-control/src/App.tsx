import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, Show, SignIn, SignUp, useAuth, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  FileUp,
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
} from "lucide-react";
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useRoute } from "wouter";
import type {
  Asset,
  AssetCondition,
  AssetInput,
  AssetStatus,
  AssetUpdate,
  ActivityEvent,
  ComplianceReport,
  ComplianceReportUpdate,
  Location,
  LocationInput,
  LocationUpdate,
  MaintenanceItem,
  MaintenanceInput,
  MaintenanceUpdate,
  Person,
  PersonInput,
  PersonUpdate,
  User,
  UserInput,
} from "@workspace/api-client-react";
import {
  setAuthTokenGetter,
  useAssignAsset,
  useBulkUpdateAssetStatus,
  useCreateAsset,
  useCreateComplianceReport,
  useCreateLocation,
  useCreateMaintenance,
  useCreatePerson,
  useCreateUser,
  useDeleteMaintenance,
  useGetAsset,
  useGetAuditLogs,
  useGetComplianceReport,
  useGetDashboardActivity,
  useGetDashboardMaintenance,
  useGetDashboardSummary,
  useListAssets,
  useListComplianceReports,
  useListLocations,
  useListMaintenance,
  useListPeople,
  useListUsers,
  useReturnAsset,
  useUpdateComplianceReport,
  useUpdateLocation,
  useUpdateMaintenance,
  useUpdatePerson,
  useUpdateUserRole,
  useUpdateAsset,
  useUpdateAssetStatus,
} from "@workspace/api-client-react";
import {
  RoleProvider,
  useRole,
  ROLE_LABELS,
  canManageAssets,
  canUpdateAssetStatus,
  canManageMaintenance,
  canCompleteMaintenance,
  canManageDirectory,
  canViewTeam,
  canOnboardUsers,
  canManageRoles,
  canViewReports,
  canEditReports,
  grantableRoles,
  ALL_ROLES,
  type Role,
} from "@/lib/role";
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
const ASSET_CATEGORIES = ["Laptop", "Monitor", "Server", "Peripheral", "Mobile", "Networking"];

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

function formatWeekDelta(value: number, noun: string) {
  if (value === 0) return `No ${noun} this week`;
  return `${value > 0 ? "+" : ""}${value} ${noun} this week`;
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
  const { role } = useRole();
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
        action={canManageAssets(role) ? <Button className="button-accent" onClick={() => setLocation("/inventory?new=1")}><Plus size={16} /> Add asset</Button> : undefined}
      />
      <div className="page-wrap">
        <div className="status-strip"><span className="pulse-dot" /> Live inventory sync <span className="strip-divider" /> Last refresh just now <button onClick={() => { void summary.refetch(); void activity.refetch(); void maintenance.refetch(); }}><RefreshCw size={13} /> Refresh</button></div>
        <div className="metric-grid fade-up">
          <MetricCard label="Total assets" value={data.total} detail={formatWeekDelta(data.changes.total, "added")} tone="teal" icon={Boxes} />
          <MetricCard label="Assigned" value={data.assigned} detail={`${data.utilization}% utilization · ${formatWeekDelta(data.changes.assigned, "net")}`} tone="blue" icon={Users} />
          <MetricCard label="In repair" value={data.inRepair} detail={formatWeekDelta(data.changes.inRepair, "service events")} tone="orange" icon={Wrench} />
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
            {canManageAssets(role) && <button onClick={() => setLocation("/inventory?new=1")}><span><PackagePlus size={17} /></span><b>Add an asset</b><small>Register equipment into inventory</small></button>}
            <button onClick={() => setLocation("/inventory")}><span><Search size={17} /></span><b>Find an asset</b><small>Search by tag, model, or serial</small></button>
            <button onClick={() => setLocation("/maintenance")}><span><Wrench size={17} /></span><b>Review maintenance</b><small>See what needs attention next</small></button>
            {canViewReports(role) && <button onClick={() => setLocation("/reports")}><span><FileText size={17} /></span><b>Audit & reports</b><small>Investigate activity and compliance</small></button>}
          </div>
        </Card>
      </div>
    </ShellPage>
  );
}

function Inventory({ openCreate = false }: { openCreate?: boolean }) {
  const { role } = useRole();
  const canManage = canManageAssets(role);
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
  const liveCategories = useMemo(() => Array.from(new Set(items.map((asset) => asset.category))), [items]);
  const categoryOptions = useMemo(
    () => Array.from(new Set([...ASSET_CATEGORIES, ...liveCategories])).sort().map((value) => ({ value, label: value })),
    [liveCategories],
  );
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
      <Topbar title="Inventory" description="Every device, peripheral, and system in one working view." action={canManage ? <Button className="button-accent" onClick={() => setShowCreate(true)}><Plus size={16} /> Add asset</Button> : undefined} />
      <div className="page-wrap">
        <div className="inventory-toolbar">
          <SearchBox value={search} onChange={setSearch} />
          <SelectField value={status} onChange={setStatus} options={statusOptions} label="Status" testId="select-status" />
          <SelectField value={category} onChange={setCategory} options={categoryOptions} label="Category" testId="select-category" />
          <SelectField value={locationId} onChange={setLocationId} options={locationOptions} label="Location" testId="select-location" />
        </div>
        <div className="inventory-summary"><div><span className="eyebrow">Asset register</span><strong>{assets.data?.total ?? "—"} records</strong>{selected.length > 0 && <span className="selection-count">{selected.length} selected</span>}</div><div className="inventory-actions">{canManage && <label className="text-button file-button"><FileUp size={14} /> Import CSV<input type="file" accept=".csv,text/csv" onChange={(event) => void importCsv(event)} /></label>}<button className="text-button" onClick={exportCsv}><Download size={14} /> Export CSV</button></div></div>
        {canManage && selected.length > 0 && <div className="bulk-toolbar"><span className="eyebrow">Bulk action</span><span>{selected.length} selected</span><SelectField value={bulkStatus} onChange={(value) => setBulkStatus(value as AssetStatus)} options={statusOptions} label="Set status" testId="select-bulk-status" /><Button className="button-dark" onClick={() => void handleBulkStatus()} disabled={bulkUpdate.isPending}>{bulkUpdate.isPending ? "Updating…" : "Apply status"}</Button><button className="text-button" onClick={() => setSelected([])}>Clear</button></div>}
        <Card className="table-card">
          {assets.isLoading ? <div className="table-loading"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : assets.isError ? <ErrorState onRetry={() => void assets.refetch()} /> : items.length ? <AssetTable items={items} selected={selected} selectable={canManage} onSelect={(id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} /> : <EmptyState title="No matching assets" text="Try a different search or clear one of the filters." />}
          {assets.data && <Pagination page={assets.data.page} pageSize={assets.data.pageSize} total={assets.data.total} onPage={(next) => { setPage(next); setSelected([]); }} />}
        </Card>
      </div>
      {canManage && showCreate && <Modal title="Add asset" onClose={() => setShowCreate(false)}><AssetForm locations={locations.data ?? []} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} submitting={create.isPending} /></Modal>}
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
        <Field label="Category" value={values.category} onChange={(value) => change("category", value)} options={ASSET_CATEGORIES.map((value) => ({ value, label: value }))} />
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
  const { role } = useRole();
  const canManage = canManageAssets(role);
  const canStatus = canUpdateAssetStatus(role);
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
      <Topbar title={data.name} description={`${data.assetTag} · ${data.category}`} action={canManage ? <Button className="button-ghost" onClick={() => setModal("edit")}><Pencil size={15} /> Edit asset</Button> : undefined} />
      <div className="page-wrap">
        <button className="back-link" onClick={() => setLocation("/inventory")}><ArrowLeft size={15} /> Back to inventory</button>
        <div className="detail-hero">
          <div className="detail-icon">{data.category.slice(0, 1)}</div>
          <div><div className="eyebrow mono">{data.assetTag}</div><h2>{data.name}</h2><p>{data.manufacturer} {data.model} <span className="dot-separator" /> Serial {data.serialNumber}</p></div>
          <div className="detail-hero-status"><StatusPill status={data.status} /><span className="muted mono">Updated {formatRelative(data.lastUpdated)}</span></div>
        </div>
        {(canManage || canStatus) && <div className="detail-actions">
          {canManage && (data.assignee ? <Button className="button-dark" onClick={() => void returnAsset()} disabled={returnMutation.isPending}><RotateCcw size={15} /> {returnMutation.isPending ? "Returning…" : "Return asset"}</Button> : <Button className="button-accent" onClick={() => setModal("assign")}><UserRound size={15} /> Assign asset</Button>)}
          {canStatus && <Button className="button-ghost" onClick={() => setModal("status")}><SlidersHorizontal size={15} /> Change status</Button>}
        </div>}
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
      {modal === "assign" && <AssignModal people={peopleQuery.data ?? []} locations={locations.data ?? []} currentLocation={data.location.id} onClose={() => setModal(null)} onSubmit={assignAsset} submitting={assign.isPending} />}
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
  const { role } = useRole();
  const canManage = canManageDirectory(role);
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
    <Topbar title="Directory" description="Keep custodians and operating locations current for clean assignments." action={canManage ? <div className="topbar-button-row"><Button className="button-ghost" onClick={() => setModal({ kind: "location" })}><MapPin size={15} /> Add location</Button><Button className="button-accent" onClick={() => setModal({ kind: "person" })}><Plus size={16} /> Add person</Button></div> : undefined} />
    <div className="page-wrap">
      <div className="directory-grid">
        <Card><SectionHeading eyebrow="Custodians" title="People" detail={`${peopleQuery.data?.length ?? "—"} people available for assignment.`} /><div className="directory-list">{peopleQuery.isLoading ? <LoadingBlock /> : peopleQuery.data?.length ? peopleQuery.data.map((person) => <div className="directory-row" key={person.id}><div className="avatar">{initials(person.name)}</div><div><b>{person.name}</b><small>{person.department} · {person.email}</small></div>{canManage && <button className="row-arrow" aria-label={`Edit ${person.name}`} onClick={() => setModal({ kind: "person", id: person.id })}><Pencil size={14} /></button>}</div>) : <EmptyState title="No people yet" text="Add a person to make assignment available." />}</div></Card>
        <Card><SectionHeading eyebrow="Operating footprint" title="Locations" detail={`${locationsQuery.data?.length ?? "—"} sites in the register.`} /><div className="directory-list">{locationsQuery.isLoading ? <LoadingBlock /> : locationsQuery.data?.length ? locationsQuery.data.map((location) => <div className="directory-row" key={location.id}><div className="avatar location-avatar"><MapPin size={15} /></div><div><b>{location.name}</b><small>{location.city} · {location.assetCount} assets</small></div>{canManage && <button className="row-arrow" aria-label={`Edit ${location.name}`} onClick={() => setModal({ kind: "location", id: location.id })}><Pencil size={14} /></button>}</div>) : <EmptyState title="No locations yet" text="Add a location before registering assets." />}</div></Card>
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
  const { role } = useRole();
  const canSchedule = canManageMaintenance(role);
  const canEdit = canCompleteMaintenance(role);
  const maintenance = useListMaintenance({ limit: 50 });
  const assets = useListAssets({ page: 1, pageSize: 100 });
  const create = useCreateMaintenance();
  const update = useUpdateMaintenance();
  const remove = useDeleteMaintenance();
  const client = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function save(values: { assetId: string; scheduledAt: string; technician: string; priority: string; status: string; resolutionNotes: string }) {
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

  return <ShellPage><Topbar title="Maintenance" description="Keep service work visible before it becomes a business interruption." action={canSchedule ? <Button className="button-accent" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Schedule work</Button> : undefined} /><div className="page-wrap"><div className="maintenance-header"><div className="queue-summary"><span className="queue-number">{maintenance.data?.length ?? "—"}</span><div><b>Open service items</b><small>Sorted by scheduled date</small></div></div><div className="legend"><span><i className="legend-dot high" /> High priority</span><span><i className="legend-dot normal" /> Planned</span></div></div><Card className="maintenance-page-card">{maintenance.isLoading ? <div className="stack-skeleton"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : maintenance.isError ? <ErrorState onRetry={() => void maintenance.refetch()} /> : maintenance.data?.length ? <MaintenanceList items={maintenance.data} onEdit={canEdit ? (item) => { setEditing(item); setShowForm(true); } : undefined} onDelete={canSchedule ? (item) => void deleteItem(item) : undefined} /> : <EmptyState title="Maintenance queue is clear" text="Nothing is scheduled for the next 14 days." />}</Card><Card className="maintenance-note"><Wrench size={18} /><div><b>Maintenance control</b><p>Schedule, reprioritize, complete, or remove service work without leaving the asset register.</p></div></Card></div>{(canSchedule || canEdit) && showForm && <Modal title={editing ? "Edit maintenance" : "Schedule maintenance"} onClose={() => { setEditing(null); setShowForm(false); }}><MaintenanceForm assets={assets.data?.items ?? []} initial={editing} editing={Boolean(editing)} onSubmit={save} onCancel={() => { setEditing(null); setShowForm(false); }} submitting={create.isPending || update.isPending} /></Modal>}</ShellPage>;
}

function MaintenanceForm({ assets, initial, editing, onSubmit, onCancel, submitting }: { assets: Asset[]; initial?: MaintenanceItem | null; editing: boolean; onSubmit: (values: { assetId: string; scheduledAt: string; technician: string; priority: string; status: string; resolutionNotes: string }) => Promise<void>; onCancel: () => void; submitting: boolean }) {
  const [values, setValues] = useState<{ assetId: string; scheduledAt: string; technician: string; priority: string; status: string; resolutionNotes: string }>({ assetId: initial ? assets.find((asset) => asset.assetTag === initial.assetTag)?.id ?? "" : assets[0]?.id ?? "", scheduledAt: initial ? new Date(initial.scheduledAt).toISOString().slice(0, 16) : "", technician: initial?.technician ?? "", priority: initial?.priority ?? "normal", status: initial?.status ?? "scheduled", resolutionNotes: initial?.resolutionNotes ?? "" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit(values); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save maintenance."); }
  }
  return <form className="asset-form" onSubmit={submit}><p className="modal-intro">Record the next service action and keep the technician accountable.</p><div className="form-grid"><Field label="Asset" value={values.assetId} onChange={(value) => setValues((current) => ({ ...current, assetId: value }))} options={assets.map((asset) => ({ value: asset.id, label: `${asset.assetTag} · ${asset.name}` }))} required /><Field label="Scheduled at" value={values.scheduledAt} onChange={(value) => setValues((current) => ({ ...current, scheduledAt: value }))} type="datetime-local" required /><Field label="Technician" value={values.technician} onChange={(value) => setValues((current) => ({ ...current, technician: value }))} placeholder="Name or team" required /><Field label="Priority" value={values.priority} onChange={(value) => setValues((current) => ({ ...current, priority: value }))} options={[{ value: "high", label: "High" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }]} /><Field label="Status" value={values.status} onChange={(value) => setValues((current) => ({ ...current, status: value }))} options={[{ value: "pending", label: "Pending" }, { value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }, { value: "overdue", label: "Overdue" }]} /></div><label className="field field-full"><span>Resolution / outcome notes</span><textarea value={values.resolutionNotes} onChange={(event) => setValues((current) => ({ ...current, resolutionNotes: event.target.value }))} placeholder="What was done, root cause, parts replaced…" rows={3} /></label>{initial?.completedAt && <p className="modal-intro" data-testid="maintenance-completed-meta">Completed {formatRelative(initial.completedAt)}{initial.completedBy ? ` by ${initial.completedBy}` : ""}.</p>}{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button><Button className="button-dark" disabled={submitting || !values.assetId}>{submitting ? "Saving…" : editing ? "Save changes" : "Schedule work"}</Button></div></form>;
}

const REPORT_STAGES: ComplianceReport["status"][] = ["in_preparation", "ready_for_review", "final"];
const REPORT_STAGE_LABEL: Record<string, string> = {
  in_preparation: "In preparation",
  ready_for_review: "Ready for review",
  final: "Final",
};
const REPORT_STAGE_TONE: Record<string, string> = {
  in_preparation: "status-orange",
  ready_for_review: "status-blue",
  final: "status-green",
};

function metricLabel(key: string) {
  const map: Record<string, string> = {
    totalAssets: "Total assets",
    assigned: "Assigned",
    inRepair: "In repair",
    available: "Available",
    maintenanceOpen: "Open maintenance",
    maintenanceCompleted: "Completed maintenance",
  };
  return map[key] ?? key;
}

function Team() {
  const { role } = useRole();
  const users = useListUsers();
  const createUser = useCreateUser();
  const updateUserRole = useUpdateUserRole();
  const client = useQueryClient();
  const { toast } = useToast();
  const [showInvite, setShowInvite] = useState(false);

  if (!canViewTeam(role)) return <NotFound />;

  async function onboard(values: { email: string; name: string; role: string }) {
    await createUser.mutateAsync({ data: { email: values.email, name: values.name, role: values.role as UserInput["role"] } });
    setShowInvite(false);
    await client.invalidateQueries();
    toast({ title: "Invitation email sent", description: `${values.email} will receive a sign-up link and claim the ${ROLE_LABELS[values.role as Role]} role at first sign-in.` });
  }

  async function changeRole(target: User, nextRole: string) {
    if (nextRole === target.role) return;
    try {
      await updateUserRole.mutateAsync({ userId: target.id, data: { role: nextRole as UserInput["role"] } });
      await client.invalidateQueries();
      toast({ title: "Role updated" });
    } catch (err) {
      toast({ title: "Could not update role", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  }

  const canRoles = canManageRoles(role);
  return <ShellPage>
    <Topbar title="Team" description="Manage who has access and what they can do." action={canOnboardUsers(role) ? <Button className="button-accent" onClick={() => setShowInvite(true)}><Plus size={16} /> Onboard user</Button> : undefined} />
    <div className="page-wrap">
      <Card className="table-card">
        {users.isLoading ? <LoadingBlock /> : users.isError ? <ErrorState onRetry={() => void users.refetch()} /> : users.data?.length ? (
          <div className="table-scroll"><table className="asset-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Onboarding</th><th>Last active</th></tr></thead><tbody>
            {users.data.map((member) => {
              const pending = member.id.startsWith("pending:");
              return <tr key={member.id} data-testid={`row-user-${member.id}`}>
                <td><div className="asset-name"><span className="asset-glyph">{initials(member.name || member.email)}</span><span><b>{member.name || "—"}</b><small className="mono">{member.email}</small></span></div></td>
                <td>{canRoles && !pending ? <label className="field-select"><select data-testid={`select-role-${member.id}`} value={member.role} onChange={(event) => void changeRole(member, event.target.value)}>{ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select><ChevronDown size={14} /></label> : <StatusPill status={pending ? member.role : member.role} />}</td>
                <td>{pending ? <span className="status-pill status-orange"><i />Invited</span> : <span className="status-pill status-green"><i />Active</span>}</td>
                <td className="muted">{member.invitedBy ? "Onboarded" : "Self-registered"}</td>
                <td className="muted">{pending ? "—" : formatRelative(member.lastSeenAt)}</td>
              </tr>;
            })}
          </tbody></table></div>
        ) : <EmptyState title="No team members yet" text="Onboard your first teammate to get started." />}
      </Card>
    </div>
    {showInvite && <Modal title="Onboard user" onClose={() => setShowInvite(false)}><InviteForm roles={grantableRoles(role)} onSubmit={onboard} onCancel={() => setShowInvite(false)} submitting={createUser.isPending} /></Modal>}
  </ShellPage>;
}

function InviteForm({ roles, onSubmit, onCancel, submitting }: { roles: Role[]; onSubmit: (values: { email: string; name: string; role: string }) => Promise<void>; onCancel: () => void; submitting: boolean }) {
  const [values, setValues] = useState<{ email: string; name: string; role: string }>({ email: "", name: "", role: roles[0] ?? "viewer" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit(values); } catch (err) { setError(err instanceof Error ? err.message : "Unable to onboard this user."); }
  }
  return <form className="asset-form" onSubmit={submit}>
    <p className="modal-intro">Invite a teammate by email. They claim the assigned role the first time they sign in.</p>
    <div className="form-grid">
      <Field label="Email" value={values.email} onChange={(value) => setValues((current) => ({ ...current, email: value }))} type="email" placeholder="teammate@company.com" required />
      <Field label="Name" value={values.name} onChange={(value) => setValues((current) => ({ ...current, name: value }))} placeholder="Full name" />
      <Field label="Role" value={values.role} onChange={(value) => setValues((current) => ({ ...current, role: value }))} options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
    </div>
    {error && <p className="form-error">{error}</p>}
    <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button><Button className="button-dark" disabled={submitting || !values.email}>{submitting ? "Onboarding…" : "Send invitation"}</Button></div>
  </form>;
}

function Reports() {
  const { role } = useRole();
  const [, setLocation] = useLocation();
  const reports = useListComplianceReports();
  const createReport = useCreateComplianceReport();
  const client = useQueryClient();
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [auditAction, setAuditAction] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const audit = useGetAuditLogs({ limit: 20, action: (auditAction || undefined) as ActivityEvent["type"] | undefined, search: auditSearch || undefined });

  if (!canViewReports(role)) return <NotFound />;

  async function createReportItem(values: { title: string; periodStart: string; periodEnd: string }) {
    await createReport.mutateAsync({ data: { title: values.title, periodStart: values.periodStart || null, periodEnd: values.periodEnd || null } });
    setShowNew(false);
    await client.invalidateQueries();
    toast({ title: "Report started" });
  }

  return <ShellPage>
    <Topbar title="Reports & audit" description="Investigate activity and assemble compliance reports." action={canEditReports(role) ? <Button className="button-accent" onClick={() => setShowNew(true)}><Plus size={16} /> New report</Button> : undefined} />
    <div className="page-wrap">
      <Card className="activity-card">
        <SectionHeading eyebrow="Audit trail" title="Activity log" detail="Every change across the estate, filterable for investigation." />
        <div className="activity-filters">
          <input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Search activity…" aria-label="Search audit log" />
          <select value={auditAction} onChange={(event) => setAuditAction(event.target.value)} aria-label="Filter activity type">
            <option value="">All activity</option><option value="assignment">Assignments</option><option value="return">Returns</option><option value="maintenance">Maintenance</option><option value="update">Updates</option><option value="import">Imports</option><option value="alert">Alerts</option>
          </select>
        </div>
        {audit.isLoading ? <div className="stack-skeleton"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : audit.isError ? <ErrorState onRetry={() => void audit.refetch()} /> : audit.data?.length ? <ActivityList events={audit.data} /> : <EmptyState title="No activity yet" />}
      </Card>
      <Card className="table-card" style={{ marginTop: 13 }}>
        <SectionHeading eyebrow="Compliance" title="Reports" detail="Draft, review, and finalize compliance reports." />
        {reports.isLoading ? <LoadingBlock /> : reports.isError ? <ErrorState onRetry={() => void reports.refetch()} /> : reports.data?.length ? (
          <div className="table-scroll"><table className="asset-table"><thead><tr><th>Report</th><th>Stage</th><th>Period</th><th>Updated</th><th /></tr></thead><tbody>
            {reports.data.map((report) => <tr key={report.id} data-testid={`row-report-${report.id}`} onClick={() => setLocation(`/reports/${report.id}`)}>
              <td><b>{report.title}</b></td>
              <td><span className={`status-pill ${REPORT_STAGE_TONE[report.status]}`}><i />{REPORT_STAGE_LABEL[report.status]}</span></td>
              <td className="muted">{report.periodStart ? `${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}` : "—"}</td>
              <td className="muted">{formatRelative(report.updatedAt)}</td>
              <td><button className="row-arrow" aria-label={`Open ${report.title}`} onClick={(event) => { event.stopPropagation(); setLocation(`/reports/${report.id}`); }}><ArrowRight size={16} /></button></td>
            </tr>)}
          </tbody></table></div>
        ) : <EmptyState title="No reports yet" text="Start a compliance report to capture findings." />}
      </Card>
    </div>
    {showNew && <Modal title="Start compliance report" onClose={() => setShowNew(false)}><ReportForm onSubmit={createReportItem} onCancel={() => setShowNew(false)} submitting={createReport.isPending} /></Modal>}
  </ShellPage>;
}

function ReportForm({ onSubmit, onCancel, submitting }: { onSubmit: (values: { title: string; periodStart: string; periodEnd: string }) => Promise<void>; onCancel: () => void; submitting: boolean }) {
  const [values, setValues] = useState<{ title: string; periodStart: string; periodEnd: string }>({ title: "", periodStart: "", periodEnd: "" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit(values); } catch (err) { setError(err instanceof Error ? err.message : "Unable to start this report."); }
  }
  return <form className="asset-form" onSubmit={submit}>
    <p className="modal-intro">Name the report and set the period under review. Fleet metrics are captured automatically.</p>
    <div className="form-grid">
      <Field label="Report title" value={values.title} onChange={(value) => setValues((current) => ({ ...current, title: value }))} placeholder="Q3 compliance review" required />
      <Field label="Period start" value={values.periodStart} onChange={(value) => setValues((current) => ({ ...current, periodStart: value }))} type="date" />
      <Field label="Period end" value={values.periodEnd} onChange={(value) => setValues((current) => ({ ...current, periodEnd: value }))} type="date" />
    </div>
    {error && <p className="form-error">{error}</p>}
    <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button><Button className="button-dark" disabled={submitting || !values.title}>{submitting ? "Starting…" : "Start report"}</Button></div>
  </form>;
}

function ReportDetailPage() {
  const { role } = useRole();
  const [, params] = useRoute("/reports/:reportId");
  const [, setLocation] = useLocation();
  const reportId = params?.reportId ?? "";
  const report = useGetComplianceReport(reportId);
  const updateReport = useUpdateComplianceReport();
  const client = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState<{ title: string; summary: string; findings: string; rootCauseNotes: string } | null>(null);

  if (!canViewReports(role)) return <NotFound />;
  if (report.isLoading) return <ShellPage><Topbar title="Report" /><div className="page-wrap"><LoadingBlock /></div></ShellPage>;
  if (report.isError || !report.data) return <ShellPage><Topbar title="Report" /><div className="page-wrap"><ErrorState message="This report could not be found." onRetry={() => void report.refetch()} /></div></ShellPage>;

  const data = report.data;
  const editable = canEditReports(role) && data.status !== "final";
  const form = draft ?? { title: data.title, summary: data.summary, findings: data.findings, rootCauseNotes: data.rootCauseNotes };
  const currentIndex = REPORT_STAGES.indexOf(data.status);
  const nextStage = REPORT_STAGES[currentIndex + 1];

  async function persist(patch: ComplianceReportUpdate, message: string) {
    try {
      await updateReport.mutateAsync({ reportId, data: patch });
      await client.invalidateQueries();
      setDraft(null);
      toast({ title: message });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  }

  return <ShellPage>
    <Topbar title={data.title} description={`Compliance report · ${REPORT_STAGE_LABEL[data.status]}`} />
    <div className="page-wrap">
      <button className="back-link" onClick={() => setLocation("/reports")}><ArrowLeft size={15} /> Back to reports</button>
      <div className="detail-hero">
        <div className="detail-icon"><FileText size={20} /></div>
        <div><div className="eyebrow">Compliance report</div><h2>{data.title}</h2><p>{data.periodStart ? `${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}` : "No period set"}</p></div>
        <div className="detail-hero-status"><span className={`status-pill ${REPORT_STAGE_TONE[data.status]}`}><i />{REPORT_STAGE_LABEL[data.status]}</span><span className="muted mono">Updated {formatRelative(data.updatedAt)}</span></div>
      </div>
      <div className="detail-grid lower">
        <Card>
          <SectionHeading eyebrow="Snapshot" title="Fleet metrics at capture" />
          <div className="spec-grid">{Object.entries(data.metrics).map(([key, value]) => <div key={key}><span>{metricLabel(key)}</span><b>{value}</b></div>)}</div>
          <div className="detail-list" style={{ marginTop: 16 }}>
            <InfoRow icon={Clock3} label="Period" value={data.periodStart ? `${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}` : "Not set"} />
            <InfoRow icon={BadgeCheck} label="Stage" value={REPORT_STAGE_LABEL[data.status]} />
            <InfoRow icon={UserRound} label="Created by" value={data.createdBy} mono />
          </div>
        </Card>
        <Card>
          <SectionHeading eyebrow="Narrative" title="Findings & root cause" />
          <div className="asset-form">
            <label className="field field-full"><span>Title</span><input value={form.title} onChange={(event) => setDraft({ ...form, title: event.target.value })} disabled={!editable} /></label>
            <label className="field field-full"><span>Summary</span><textarea rows={3} value={form.summary} onChange={(event) => setDraft({ ...form, summary: event.target.value })} disabled={!editable} placeholder="Executive summary of compliance posture…" /></label>
            <label className="field field-full"><span>Findings</span><textarea rows={4} value={form.findings} onChange={(event) => setDraft({ ...form, findings: event.target.value })} disabled={!editable} placeholder="What the investigation uncovered…" /></label>
            <label className="field field-full"><span>Root cause notes</span><textarea rows={4} value={form.rootCauseNotes} onChange={(event) => setDraft({ ...form, rootCauseNotes: event.target.value })} disabled={!editable} placeholder="Root causes and corrective actions…" /></label>
            {editable && <div className="modal-actions">
              {draft && <Button type="button" className="button-ghost" onClick={() => setDraft(null)}>Discard</Button>}
              <Button type="button" className="button-dark" disabled={!draft || updateReport.isPending} onClick={() => void persist({ title: form.title, summary: form.summary, findings: form.findings, rootCauseNotes: form.rootCauseNotes }, "Report saved")}>{updateReport.isPending ? "Saving…" : "Save changes"}</Button>
            </div>}
            {data.status === "final" && <p className="modal-intro">This report is finalized and locked — it can no longer be edited.</p>}
          </div>
        </Card>
      </div>
      {canEditReports(role) && nextStage && <Card className="maintenance-note">
        <ClipboardCheck size={18} />
        <div><b>Advance workflow</b><p>Move this report from <b>{REPORT_STAGE_LABEL[data.status]}</b> to <b>{REPORT_STAGE_LABEL[nextStage]}</b>.</p></div>
        <Button className="button-accent" disabled={updateReport.isPending} onClick={() => { if (nextStage === "final" && !window.confirm("Finalize this report? It will be locked and can no longer be edited.")) return; void persist({ status: nextStage }, `Report moved to ${REPORT_STAGE_LABEL[nextStage]}`); }}>{nextStage === "final" ? "Finalize report" : `Move to ${REPORT_STAGE_LABEL[nextStage]}`}</Button>
      </Card>}
    </div>
  </ShellPage>;
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
  return <><Show when="signed-in"><RoleProvider><Switch><Route path="/workspace" component={Dashboard} /><Route path="/inventory">{() => <Inventory openCreate={new URLSearchParams(window.location.search).get("new") === "1"} />}</Route><Route path="/assets/:assetId" component={AssetDetailPage} /><Route path="/maintenance" component={Maintenance} /><Route path="/directory" component={Directory} /><Route path="/team" component={Team} /><Route path="/reports/:reportId" component={ReportDetailPage} /><Route path="/reports" component={Reports} /><Route component={NotFound} /></Switch></RoleProvider></Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function SignInPage() {
  return <div className="auth-page"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="auth-page"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function ClerkApiAuthBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
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
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: "Welcome back", subtitle: "Sign in to access your workspace" } }, signUp: { start: { title: "Create your workspace", subtitle: "Get started with AssetControl" } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}><QueryClientProvider client={queryClient}><ClerkApiAuthBridge /><ClerkQueryClientCacheInvalidator /><Switch><Route path="/" component={HomeRedirect} /><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route path="/workspace" component={UserPortal} /><Route path="/inventory" component={UserPortal} /><Route path="/assets/:assetId" component={UserPortal} /><Route path="/maintenance" component={UserPortal} /><Route path="/directory" component={UserPortal} /><Route path="/team" component={UserPortal} /><Route path="/reports/:reportId" component={UserPortal} /><Route path="/reports" component={UserPortal} /><Route component={UserPortal} /></Switch><Toaster /></QueryClientProvider></ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;