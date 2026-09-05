import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
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
  Trash2,
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
  Department,
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
  useBulkDeleteAssets,
  useBulkUpdateAssetStatus,
  useCreateAsset,
  useCreateAssetAttachment,
  useCreateComplianceReport,
  useCreateDepartment,
  useCreateLocation,
  useCreateMaintenance,
  useCreateMaintenanceAttachment,
  useCreatePerson,
  useCreateUser,
  useDeleteAsset,
  useDeleteAttachment,
  useDeleteComplianceReport,
  useDeleteDepartment,
  useDeleteLocation,
  useDeleteMaintenance,
  useDeletePerson,
  useDeleteUser,
  useGetAsset,
  useGetAuditLogs,
  useGetComplianceReport,
  useGetDashboardActivity,
  useGetDashboardMaintenance,
  useGetDashboardSummary,
  useListAssetAttachments,
  useListAssets,
  useListComplianceReports,
  useListDepartments,
  useListLocations,
  useListMaintenance,
  useListMaintenanceAttachments,
  useListPeople,
  useListUsers,
  useReturnAsset,
  useUpdateComplianceReport,
  useUpdateDepartment,
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
  canDeleteAssets,
  canDeleteDirectory,
  canDeleteTeamMembers,
  canDeleteReports,
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
  ACTIVITY_TYPE_OPTIONS,
  AppFooter,
  AppShell,
  AssetTable,
  Button,
  Card,
  EmptyState,
  ErrorState,
  fileToAttachmentPayload,
  formatDate,
  formatMoney,
  formatRelative,
  LoadingBlock,
  MaintenanceList,
  MetricCard,
  Modal,
  Pagination,
  PhotoGallery,
  PhotoPicker,
  SearchBox,
  SelectField,
  Sidebar,
  Skeleton,
  StatusPill,
  Topbar,
} from "@/components/asset-ui";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { DataImportModal } from "@/components/data-import";
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
  description: string;
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
  description: "",
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

function apiErrorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return err instanceof Error ? err.message : fallback;
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
  const canDelete = canDeleteAssets(role);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [locationId, setLocationId] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<AssetStatus>("available");
  const [showCreate, setShowCreate] = useState(openCreate);
  const [showImport, setShowImport] = useState(false);
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
  const createPhoto = useCreateAssetAttachment();
  const removeAsset = useDeleteAsset();
  const bulkDelete = useBulkDeleteAssets();
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

  async function handleCreate(values: FormValues, photos: File[]) {
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
      description: values.description,
    };
    const created = await create.mutateAsync({ data: body });
    for (const file of photos.slice(0, 5)) {
      await createPhoto.mutateAsync({ assetId: created.id, data: await fileToAttachmentPayload(file) });
    }
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

  async function handleDeleteAsset(asset: Asset) {
    if (!window.confirm(`Delete ${asset.assetTag} (${asset.name})? This also removes its maintenance history and photos.`)) return;
    try {
      await removeAsset.mutateAsync({ assetId: asset.id });
      setSelected((current) => current.filter((id) => id !== asset.id));
      await client.invalidateQueries();
      toast({ title: "Asset deleted" });
    } catch (err) {
      toast({ title: "Could not delete asset", description: apiErrorMessage(err, "Unable to delete this asset."), variant: "destructive" });
    }
  }

  async function handleBulkDelete() {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} selected assets? This also removes their maintenance history and photos.`)) return;
    try {
      await bulkDelete.mutateAsync({ data: { assetIds: selected } });
      setSelected([]);
      await client.invalidateQueries();
      toast({ title: "Selected assets deleted" });
    } catch (err) {
      toast({ title: "Could not delete assets", description: apiErrorMessage(err, "Unable to delete the selected assets."), variant: "destructive" });
    }
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

  return (
    <ShellPage>
      <Topbar title="Inventory" description="Every device, peripheral, and system in one working view." action={canManage ? <div className="topbar-button-row"><Button className="button-ghost" onClick={() => setShowImport(true)}><FileUp size={15} /> Import inventory</Button><Button className="button-accent" onClick={() => setShowCreate(true)}><Plus size={16} /> Add asset</Button></div> : undefined} />
      <div className="page-wrap">
        <div className="inventory-toolbar">
          <SearchBox value={search} onChange={setSearch} />
          <SelectField value={status} onChange={setStatus} options={statusOptions} label="Status" testId="select-status" />
          <SelectField value={category} onChange={setCategory} options={categoryOptions} label="Category" testId="select-category" />
          <SelectField value={locationId} onChange={setLocationId} options={locationOptions} label="Location" testId="select-location" />
        </div>
        <div className="inventory-summary"><div><span className="eyebrow">Asset register</span><strong>{assets.data?.total ?? "—"} records</strong>{selected.length > 0 && <span className="selection-count">{selected.length} selected</span>}</div><div className="inventory-actions"><button className="text-button" onClick={exportCsv}><Download size={14} /> Export CSV</button></div></div>
        {canManage && selected.length > 0 && <div className="bulk-toolbar"><span className="eyebrow">Bulk action</span><span>{selected.length} selected</span><SelectField value={bulkStatus} onChange={(value) => setBulkStatus(value as AssetStatus)} options={statusOptions} label="Set status" testId="select-bulk-status" /><Button className="button-dark" onClick={() => void handleBulkStatus()} disabled={bulkUpdate.isPending}>{bulkUpdate.isPending ? "Updating…" : "Apply status"}</Button>{canDelete && <Button className="button-ghost" onClick={() => void handleBulkDelete()} disabled={bulkDelete.isPending}>{bulkDelete.isPending ? "Deleting…" : "Delete selected"}</Button>}<button className="text-button" onClick={() => setSelected([])}>Clear</button></div>}
        <Card className="table-card">
          {assets.isLoading ? <div className="table-loading"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : assets.isError ? <ErrorState onRetry={() => void assets.refetch()} /> : items.length ? <AssetTable items={items} selected={selected} selectable={canManage} onSelect={(id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onDelete={canDelete ? handleDeleteAsset : undefined} /> : <EmptyState title="No matching assets" text="Try a different search or clear one of the filters." />}
          {assets.data && <Pagination page={assets.data.page} pageSize={assets.data.pageSize} total={assets.data.total} onPage={(next) => { setPage(next); setSelected([]); }} />}
        </Card>
      </div>
      {canManage && showCreate && <Modal title="Add asset" onClose={() => setShowCreate(false)}><AssetForm locations={locations.data ?? []} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} submitting={create.isPending} /></Modal>}
      {canManage && showImport && <DataImportModal initialTab="assets" onClose={() => setShowImport(false)} />}
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
  onSubmit: (values: FormValues, photos: File[]) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [values, setValues] = useState<FormValues>({ ...blankForm, locationId: locations[0]?.id ?? "", ...initial });
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  function change(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit(values, photos); } catch (err) { setError(apiErrorMessage(err, "Unable to save this asset.")); }
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
        {!editing && <Field label="Status" value={values.status} onChange={(value) => change("status", value)} options={statusOptions} /> }
        <Field label="Purchase cost" value={values.purchaseCost} onChange={(value) => change("purchaseCost", value)} placeholder="0.00" type="number" />
        <Field label="Purchase date" value={values.purchaseDate} onChange={(value) => change("purchaseDate", value)} type="date" />
        <Field label="Warranty end" value={values.warrantyEnd} onChange={(value) => change("warrantyEnd", value)} type="date" />
      </div>
      <label className="field field-full"><span>Description</span><textarea value={values.description} onChange={(event) => change("description", event.target.value)} placeholder="What this asset is and how it is used. This is not the asset name." rows={3} /></label>
      <label className="field field-full"><span>Notes</span><textarea value={values.notes} onChange={(event) => change("notes", event.target.value)} placeholder="Add useful context for the next operator…" rows={3} /></label>
      {!editing && <PhotoPicker files={photos} onChange={setPhotos} remaining={5 - photos.length} />}
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
  const canDelete = canDeleteAssets(role);
  const [, params] = useRoute("/assets/:assetId");
  const [, setLocation] = useLocation();
  const assetId = params?.assetId ?? "";
  const asset = useGetAsset(assetId);
  const locations = useListLocations();
  const peopleQuery = useListPeople();
  const photos = useListAssetAttachments(assetId);
  const update = useUpdateAsset();
  const assign = useAssignAsset();
  const returnMutation = useReturnAsset();
  const statusMutation = useUpdateAssetStatus();
  const createPhoto = useCreateAssetAttachment();
  const removePhoto = useDeleteAttachment();
  const removeAsset = useDeleteAsset();
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
      description: values.description,
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
  async function uploadPhotos(files: File[]) {
    try {
      for (const file of files) {
        await createPhoto.mutateAsync({ assetId, data: await fileToAttachmentPayload(file) });
      }
      await refresh("Photo added");
    } catch (err) {
      toast({ title: "Could not add photo", description: apiErrorMessage(err, "Unable to save this photo."), variant: "destructive" });
    }
  }
  async function deletePhoto(attachmentId: string) {
    if (!window.confirm("Remove this photo?")) return;
    try {
      await removePhoto.mutateAsync({ attachmentId });
      await refresh("Photo removed");
    } catch (err) {
      toast({ title: "Could not remove photo", description: apiErrorMessage(err, "Unable to remove this photo."), variant: "destructive" });
    }
  }
  async function deleteThisAsset() {
    if (!window.confirm(`Delete ${data.assetTag} (${data.name})? This also removes its maintenance history and photos.`)) return;
    try {
      await removeAsset.mutateAsync({ assetId });
      toast({ title: "Asset deleted" });
      setLocation("/inventory");
    } catch (err) {
      toast({ title: "Could not delete asset", description: apiErrorMessage(err, "Unable to delete this asset."), variant: "destructive" });
    }
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
    description: data.description,
  };
  return (
    <ShellPage>
      <Topbar title={data.name} description={`${data.assetTag} · ${data.category}`} action={canManage ? <div className="topbar-button-row">{canDelete && <Button className="button-ghost" onClick={() => void deleteThisAsset()}><Trash2 size={15} /> Delete</Button>}<Button className="button-ghost" onClick={() => setModal("edit")}><Pencil size={15} /> Edit asset</Button></div> : undefined} />
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
          <Card><SectionHeading eyebrow="At a glance" title="Ownership & location" /><div className="detail-list"><InfoRow icon={UserRound} label="Assigned to" value={data.assignee?.name ?? "Available in inventory"} secondary={data.assignee?.department} /><InfoRow icon={Clock3} label="Date of allocation" value={data.assignedAt ? formatDate(data.assignedAt) : "Not allocated"} /><InfoRow icon={MapPin} label="Current location" value={data.location.name} secondary={data.location.city} /><InfoRow icon={ClipboardCheck} label="Condition" value={data.condition[0].toUpperCase() + data.condition.slice(1)} /><InfoRow icon={Clock3} label="Warranty end" value={formatDate(data.warrantyEnd)} /></div></Card>
          <Card><SectionHeading eyebrow="Purchase record" title="Financial details" /><div className="detail-list"><InfoRow icon={PackagePlus} label="Purchase cost" value={formatMoney(data.purchaseCost)} /><InfoRow icon={Clock3} label="Purchase date" value={formatDate(data.purchaseDate)} /><InfoRow icon={ShieldCheck} label="Serial number" value={data.serialNumber} mono /><InfoRow icon={Boxes} label="Asset category" value={data.category} /></div></Card>
        </div>
        <div className="detail-grid lower">
          <Card>
            <SectionHeading eyebrow="Record" title="Description & notes" />
            {data.description ? <div className="description-box"><span className="eyebrow">Description</span><p>{data.description}</p></div> : <EmptyState title="No description" text="Add a description to explain what this asset is, separately from its name." />}
            {data.notes && <div className="notes-box"><span className="eyebrow">Operator notes</span><p>{data.notes}</p></div>}
            {Object.keys(data.specifications).length ? <div className="spec-grid" style={{ marginTop: 15 }}>{Object.entries(data.specifications).map(([key, value]) => <div key={key}><span>{key}</span><b>{value}</b></div>)}</div> : null}
          </Card>
          <Card><SectionHeading eyebrow="Audit trail" title="Recent history" />{data.history.length ? <div className="history-list">{data.history.map((event) => <div className="history-row" key={event.id}><span className="history-dot" /><div><b>{event.detail}</b><small>{event.actor} · {formatRelative(event.createdAt)}</small></div></div>)}</div> : <EmptyState title="No activity yet" />}</Card>
        </div>
        <Card className="table-card" style={{ marginTop: 13, padding: 20 }}>
          <SectionHeading eyebrow="Photos" title="Asset photos" detail="Up to five images, 5 MB each." />
          <PhotoGallery
            attachments={photos.data ?? []}
            remaining={5 - (photos.data?.length ?? 0)}
            adding={createPhoto.isPending}
            onAdd={canManage ? (files) => void uploadPhotos(files) : undefined}
            onRemove={canManage ? (attachment) => void deletePhoto(attachment.id) : undefined}
          />
        </Card>
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

type DirectoryModal = { kind: "person" | "location" | "department"; id?: string } | null;

function Directory() {
  const { role } = useRole();
  const canManage = canManageDirectory(role);
  const canDelete = canDeleteDirectory(role);
  const peopleQuery = useListPeople();
  const locationsQuery = useListLocations();
  const departmentsQuery = useListDepartments();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const deletePerson = useDeletePerson();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const client = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<DirectoryModal>(null);
  const [showImport, setShowImport] = useState(false);

  async function savePerson(values: { name: string; departmentId: string; email: string }) {
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

  async function saveDepartment(values: { name: string }) {
    if (modal?.kind === "department" && modal.id) await updateDepartment.mutateAsync({ departmentId: modal.id, data: values });
    else await createDepartment.mutateAsync({ data: values });
    setModal(null);
    await client.invalidateQueries();
    toast({ title: modal?.id ? "Department updated" : "Department added" });
  }

  async function removeRecord(kind: "person" | "location" | "department", id: string, label: string) {
    if (!window.confirm(`Delete ${label}?`)) return;
    try {
      if (kind === "person") await deletePerson.mutateAsync({ personId: id });
      if (kind === "location") await deleteLocation.mutateAsync({ locationId: id });
      if (kind === "department") await deleteDepartment.mutateAsync({ departmentId: id });
      await client.invalidateQueries();
      toast({ title: `${label} deleted` });
    } catch (err) {
      toast({ title: `Could not delete ${label}`, description: apiErrorMessage(err, "Unable to delete this record."), variant: "destructive" });
    }
  }

  const editingPerson = modal?.kind === "person" ? peopleQuery.data?.find((person) => person.id === modal.id) : undefined;
  const editingLocation = modal?.kind === "location" ? locationsQuery.data?.find((location) => location.id === modal.id) : undefined;
  const editingDepartment = modal?.kind === "department" ? departmentsQuery.data?.find((department) => department.id === modal.id) : undefined;
  const departments = departmentsQuery.data ?? [];
  return <ShellPage>
    <Topbar title="Directory" description="Keep departments, custodians, and operating locations current for clean assignments." action={canManage ? <div className="topbar-button-row"><Button className="button-ghost" onClick={() => setShowImport(true)}><FileUp size={15} /> Import people</Button><Button className="button-ghost" onClick={() => setModal({ kind: "department" })}>Add department</Button><Button className="button-ghost" onClick={() => setModal({ kind: "location" })}><MapPin size={15} /> Add location</Button><Button className="button-accent" onClick={() => setModal({ kind: "person" })}><Plus size={16} /> Add person</Button></div> : undefined} />
    <div className="page-wrap">
      <div className="directory-grid">
        <Card><SectionHeading eyebrow="Organization" title="Departments" detail={`${departmentsQuery.data?.length ?? "—"} departments in the lookup.`} /><div className="directory-list">{departmentsQuery.isLoading ? <LoadingBlock /> : departmentsQuery.data?.length ? departmentsQuery.data.map((department) => <div className="directory-row" key={department.id}><div className="avatar department-avatar">{department.name.slice(0, 1)}</div><div><b>{department.name}</b><small>{department.personCount} people</small></div>{canManage && <button className="row-arrow" aria-label={`Edit ${department.name}`} onClick={() => setModal({ kind: "department", id: department.id })}><Pencil size={14} /></button>}{canDelete && <button className="row-arrow danger-action" aria-label={`Delete ${department.name}`} onClick={() => void removeRecord("department", department.id, department.name)}><Trash2 size={14} /></button>}</div>) : <EmptyState title="No departments yet" text="Add a department before assigning people." />}</div></Card>
        <Card><SectionHeading eyebrow="Custodians" title="People" detail={`${peopleQuery.data?.length ?? "—"} people available for assignment.`} /><div className="directory-list">{peopleQuery.isLoading ? <LoadingBlock /> : peopleQuery.data?.length ? peopleQuery.data.map((person) => <div className="directory-row" key={person.id}><div className="avatar">{initials(person.name)}</div><div><b>{person.name}</b><small>{person.department} · {person.email}</small></div>{canManage && <button className="row-arrow" aria-label={`Edit ${person.name}`} onClick={() => setModal({ kind: "person", id: person.id })}><Pencil size={14} /></button>}{canDelete && <button className="row-arrow danger-action" aria-label={`Delete ${person.name}`} onClick={() => void removeRecord("person", person.id, person.name)}><Trash2 size={14} /></button>}</div>) : <EmptyState title="No people yet" text="Add a person to make assignment available." />}</div></Card>
        <Card><SectionHeading eyebrow="Operating footprint" title="Locations" detail={`${locationsQuery.data?.length ?? "—"} sites in the register.`} /><div className="directory-list">{locationsQuery.isLoading ? <LoadingBlock /> : locationsQuery.data?.length ? locationsQuery.data.map((location) => <div className="directory-row" key={location.id}><div className="avatar location-avatar"><MapPin size={15} /></div><div><b>{location.name}</b><small>{location.city} · {location.assetCount} assets</small></div>{canManage && <button className="row-arrow" aria-label={`Edit ${location.name}`} onClick={() => setModal({ kind: "location", id: location.id })}><Pencil size={14} /></button>}{canDelete && <button className="row-arrow danger-action" aria-label={`Delete ${location.name}`} onClick={() => void removeRecord("location", location.id, location.name)}><Trash2 size={14} /></button>}</div>) : <EmptyState title="No locations yet" text="Add a location before registering assets." />}</div></Card>
      </div>
    </div>
    {modal?.kind === "person" && <Modal title={editingPerson ? "Edit person" : "Add person"} onClose={() => setModal(null)}><PersonForm initial={editingPerson} departments={departments} onSubmit={savePerson} onCancel={() => setModal(null)} submitting={createPerson.isPending || updatePerson.isPending} /></Modal>}
    {modal?.kind === "location" && <Modal title={editingLocation ? "Edit location" : "Add location"} onClose={() => setModal(null)}><LocationForm initial={editingLocation} onSubmit={saveLocation} onCancel={() => setModal(null)} submitting={createLocation.isPending || updateLocation.isPending} /></Modal>}
    {modal?.kind === "department" && <Modal title={editingDepartment ? "Edit department" : "Add department"} onClose={() => setModal(null)}><DepartmentForm initial={editingDepartment} onSubmit={saveDepartment} onCancel={() => setModal(null)} submitting={createDepartment.isPending || updateDepartment.isPending} /></Modal>}
    {canManage && showImport && <DataImportModal initialTab="people" onClose={() => setShowImport(false)} />}
  </ShellPage>;
}

function PersonForm({ initial, departments, onSubmit, onCancel, submitting }: { initial?: Partial<Person>; departments: Department[]; onSubmit: (values: { name: string; departmentId: string; email: string }) => Promise<void>; onCancel: () => void; submitting: boolean }) {
  const [values, setValues] = useState({ name: initial?.name ?? "", departmentId: initial?.departmentId ?? departments[0]?.id ?? "", email: initial?.email ?? "" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit(values); } catch (err) { setError(apiErrorMessage(err, "Unable to save this record.")); }
  }
  if (!departments.length) {
    return <div className="asset-form"><p className="modal-intro">Add a department first, then you can assign people to it.</p><div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Close</Button></div></div>;
  }
  return <form className="asset-form" onSubmit={submit}><div className="form-grid"><Field label="Name" value={values.name} onChange={(value) => setValues((current) => ({ ...current, name: value }))} required /><Field label="Department" value={values.departmentId} onChange={(value) => setValues((current) => ({ ...current, departmentId: value }))} options={departments.map((department) => ({ value: department.id, label: department.name }))} required /><Field label="Email" value={values.email} onChange={(value) => setValues((current) => ({ ...current, email: value }))} type="email" required /></div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button><Button className="button-dark" disabled={submitting}>{submitting ? "Saving…" : "Save record"}</Button></div></form>;
}

function LocationForm({ initial, onSubmit, onCancel, submitting }: { initial?: Partial<Location>; onSubmit: (values: { name: string; city: string }) => Promise<void>; onCancel: () => void; submitting: boolean }) {
  const [values, setValues] = useState({ name: initial?.name ?? "", city: initial?.city ?? "" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit(values); } catch (err) { setError(apiErrorMessage(err, "Unable to save this record.")); }
  }
  return <form className="asset-form" onSubmit={submit}><div className="form-grid"><Field label="Name" value={values.name} onChange={(value) => setValues((current) => ({ ...current, name: value }))} required /><Field label="City / region" value={values.city} onChange={(value) => setValues((current) => ({ ...current, city: value }))} placeholder="Bengaluru" required /></div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button><Button className="button-dark" disabled={submitting}>{submitting ? "Saving…" : "Save record"}</Button></div></form>;
}

function DepartmentForm({ initial, onSubmit, onCancel, submitting }: { initial?: Partial<Department>; onSubmit: (values: { name: string }) => Promise<void>; onCancel: () => void; submitting: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit({ name }); } catch (err) { setError(apiErrorMessage(err, "Unable to save this department.")); }
  }
  return <form className="asset-form" onSubmit={submit}><Field label="Department name" value={name} onChange={setName} placeholder="Operations" required />{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button><Button className="button-dark" disabled={submitting}>{submitting ? "Saving…" : "Save department"}</Button></div></form>;
}

function Maintenance() {
  const { role } = useRole();
  const canSchedule = canManageMaintenance(role);
  const canEdit = canCompleteMaintenance(role);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [scope, setScope] = useState("");
  const [activityType, setActivityType] = useState("");
  const [priority, setPriority] = useState("");
  const maintenance = useListMaintenance({
    limit: 50,
    search: search || undefined,
    status: (status || undefined) as MaintenanceItem["status"] | undefined,
    mode: (mode || undefined) as MaintenanceItem["mode"] | undefined,
    scope: (scope || undefined) as MaintenanceItem["scope"] | undefined,
    activityType: (activityType || undefined) as MaintenanceItem["activityType"] | undefined,
    priority: (priority || undefined) as MaintenanceItem["priority"] | undefined,
  });
  const assets = useListAssets({ page: 1, pageSize: 100 });
  const create = useCreateMaintenance();
  const update = useUpdateMaintenance();
  const remove = useDeleteMaintenance();
  const createPhoto = useCreateMaintenanceAttachment();
  const client = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [showForm, setShowForm] = useState<"asset" | "estate" | false>(false);

  async function save(values: MaintenanceFormValues, photos: File[]) {
    const data: MaintenanceInput = {
      title: values.title,
      assetId: values.scope === "estate" ? null : values.assetId,
      scope: values.scope as MaintenanceInput["scope"],
      mode: values.mode as MaintenanceInput["mode"],
      activityType: values.scope === "estate" ? values.activityType as MaintenanceInput["activityType"] : "other",
      scheduledAt: new Date(values.scheduledAt).toISOString(),
      technician: values.technician,
      priority: values.priority as MaintenanceInput["priority"],
      status: values.status as MaintenanceInput["status"],
      resolutionNotes: values.resolutionNotes,
    };
    const saved = editing
      ? await update.mutateAsync({ maintenanceId: editing.id, data: data as MaintenanceUpdate })
      : await create.mutateAsync({ data });
    for (const file of photos.slice(0, 5)) {
      await createPhoto.mutateAsync({ maintenanceId: saved.id, data: await fileToAttachmentPayload(file) });
    }
    setEditing(null);
    setShowForm(false);
    await client.invalidateQueries();
    toast({ title: editing ? "Maintenance updated" : "Maintenance scheduled" });
  }

  async function deleteItem(item: MaintenanceItem) {
    if (!window.confirm(`Remove “${item.title}”?`)) return;
    await remove.mutateAsync({ maintenanceId: item.id });
    await client.invalidateQueries();
    toast({ title: "Maintenance item removed" });
  }

  return <ShellPage>
    <Topbar title="Maintenance" description="Device service and preventive work share one queue: OS/app patches, LAN, and firewall updates included." action={canSchedule ? <div className="topbar-button-row"><Button className="button-ghost" onClick={() => { setEditing(null); setShowForm("estate"); }}>Preventive work</Button><Button className="button-accent" onClick={() => { setEditing(null); setShowForm("asset"); }}><Plus size={16} /> Device work</Button></div> : undefined} />
    <div className="page-wrap">
      <div className="inventory-toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="Search title, technician, or asset tag…" />
        <SelectField value={status} onChange={setStatus} options={[{ value: "pending", label: "Pending" }, { value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }, { value: "overdue", label: "Overdue" }]} label="Status" testId="select-maintenance-status" />
        <SelectField value={mode} onChange={setMode} options={[{ value: "scheduled", label: "Scheduled" }, { value: "emergency", label: "Emergency" }]} label="Mode" testId="select-maintenance-mode" />
        <SelectField value={scope} onChange={setScope} options={[{ value: "asset", label: "Device" }, { value: "estate", label: "Preventive" }]} label="Scope" testId="select-maintenance-scope" />
        <SelectField value={activityType} onChange={setActivityType} options={ACTIVITY_TYPE_OPTIONS} label="Activity" testId="select-maintenance-activity" />
        <SelectField value={priority} onChange={setPriority} options={[{ value: "high", label: "High" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }]} label="Priority" testId="select-maintenance-priority" />
      </div>
      <div className="maintenance-header"><div className="queue-summary"><span className="queue-number">{maintenance.data?.length ?? "—"}</span><div><b>Open service items</b><small>Sorted by scheduled date</small></div></div><div className="legend"><span><i className="legend-dot high" /> High priority</span><span><i className="legend-dot normal" /> Planned</span></div></div>
      <Card className="maintenance-page-card">{maintenance.isLoading ? <div className="stack-skeleton"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : maintenance.isError ? <ErrorState onRetry={() => void maintenance.refetch()} /> : maintenance.data?.length ? <MaintenanceList items={maintenance.data} onEdit={canEdit ? (item) => { setEditing(item); setShowForm(item.scope === "estate" ? "estate" : "asset"); } : undefined} onDelete={canSchedule ? (item) => void deleteItem(item) : undefined} /> : <EmptyState title="Maintenance queue is clear" text="Nothing matches these filters, or nothing is scheduled." />}</Card>
      <Card className="maintenance-note"><Wrench size={18} /><div><b>Maintenance control</b><p>Schedule, reprioritize, complete, or remove service work without leaving the asset register. Preventive OS, application, LAN, and firewall work lives on this same queue.</p></div></Card>
    </div>
    {(canSchedule || canEdit) && showForm && <Modal title={editing ? "Edit maintenance" : showForm === "estate" ? "Schedule preventive work" : "Schedule device work"} onClose={() => { setEditing(null); setShowForm(false); }}><MaintenanceForm assets={assets.data?.items ?? []} initial={editing} scope={editing?.scope ?? showForm} editing={Boolean(editing)} onSubmit={save} onCancel={() => { setEditing(null); setShowForm(false); }} submitting={create.isPending || update.isPending || createPhoto.isPending} /></Modal>}
  </ShellPage>;
}

type MaintenanceFormValues = {
  title: string;
  assetId: string;
  scope: "asset" | "estate";
  mode: string;
  activityType: string;
  scheduledAt: string;
  technician: string;
  priority: string;
  status: string;
  resolutionNotes: string;
};

function MaintenanceForm({ assets, initial, scope, editing, onSubmit, onCancel, submitting }: { assets: Asset[]; initial?: MaintenanceItem | null; scope: "asset" | "estate"; editing: boolean; onSubmit: (values: MaintenanceFormValues, photos: File[]) => Promise<void>; onCancel: () => void; submitting: boolean }) {
  const [values, setValues] = useState<MaintenanceFormValues>({
    title: initial?.title ?? "",
    assetId: initial?.assetId ?? assets[0]?.id ?? "",
    scope,
    mode: initial?.mode ?? "scheduled",
    activityType: initial?.activityType ?? "os_patch",
    scheduledAt: initial ? new Date(initial.scheduledAt).toISOString().slice(0, 16) : "",
    technician: initial?.technician ?? "",
    priority: initial?.priority ?? "normal",
    status: initial?.status ?? "scheduled",
    resolutionNotes: initial?.resolutionNotes ?? "",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try { await onSubmit(values, photos); } catch (err) { setError(apiErrorMessage(err, "Unable to save maintenance.")); }
  }
  const remaining = 5 - photos.length;
  return <form className="asset-form" onSubmit={submit}>
    <p className="modal-intro">{values.scope === "estate" ? "Record preventive OS, application, LAN, or firewall work. This is not tied to a single device." : "Record the next service action for a device and keep the technician accountable."}</p>
    <div className="form-grid">
      <Field label="Title" value={values.title} onChange={(value) => setValues((current) => ({ ...current, title: value }))} placeholder={values.scope === "estate" ? "Windows 11 security patch" : "Battery replacement"} required />
      {values.scope === "asset" && <Field label="Asset" value={values.assetId} onChange={(value) => setValues((current) => ({ ...current, assetId: value }))} options={assets.map((asset) => ({ value: asset.id, label: `${asset.assetTag} · ${asset.name}` }))} required />}
      {values.scope === "estate" && <Field label="Activity type" value={values.activityType} onChange={(value) => setValues((current) => ({ ...current, activityType: value }))} options={ACTIVITY_TYPE_OPTIONS} required />}
      <Field label="Mode" value={values.mode} onChange={(value) => setValues((current) => ({ ...current, mode: value }))} options={[{ value: "scheduled", label: "Scheduled" }, { value: "emergency", label: "Emergency" }]} />
      <Field label="Scheduled at" value={values.scheduledAt} onChange={(value) => setValues((current) => ({ ...current, scheduledAt: value }))} type="datetime-local" required />
      <Field label="Technician" value={values.technician} onChange={(value) => setValues((current) => ({ ...current, technician: value }))} placeholder="Name or team" required />
      <Field label="Priority" value={values.priority} onChange={(value) => setValues((current) => ({ ...current, priority: value }))} options={[{ value: "high", label: "High" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }]} />
      <Field label="Status" value={values.status} onChange={(value) => setValues((current) => ({ ...current, status: value }))} options={[{ value: "pending", label: "Pending" }, { value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }, { value: "overdue", label: "Overdue" }]} />
    </div>
    <label className="field field-full"><span>Resolution / outcome notes</span><textarea value={values.resolutionNotes} onChange={(event) => setValues((current) => ({ ...current, resolutionNotes: event.target.value }))} placeholder="What was done, root cause, parts replaced…" rows={3} /></label>
    {initial?.completedAt && <p className="modal-intro" data-testid="maintenance-completed-meta">Completed {formatRelative(initial.completedAt)}{initial.completedBy ? ` by ${initial.completedBy}` : ""}.</p>}
    {initial && <MaintenancePhotos maintenanceId={initial.id} />}
    {!initial && <PhotoPicker files={photos} onChange={setPhotos} remaining={remaining} />}
    {error && <p className="form-error">{error}</p>}
    <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button><Button className="button-dark" disabled={submitting || (values.scope === "asset" && !values.assetId) || !values.title}>{submitting ? "Saving…" : editing ? "Save changes" : "Schedule work"}</Button></div>
  </form>;
}

function MaintenancePhotos({ maintenanceId }: { maintenanceId: string }) {
  const existingPhotos = useListMaintenanceAttachments(maintenanceId);
  const removePhoto = useDeleteAttachment();
  const addPhoto = useCreateMaintenanceAttachment();
  const client = useQueryClient();
  const { toast } = useToast();
  async function uploadExisting(files: File[]) {
    try {
      for (const file of files) {
        await addPhoto.mutateAsync({ maintenanceId, data: await fileToAttachmentPayload(file) });
      }
      await client.invalidateQueries();
    } catch (err) {
      toast({ title: "Could not add photo", description: apiErrorMessage(err, "Unable to save this photo."), variant: "destructive" });
    }
  }
  async function deleteExisting(attachmentId: string) {
    if (!window.confirm("Remove this photo?")) return;
    try {
      await removePhoto.mutateAsync({ attachmentId });
      await client.invalidateQueries();
    } catch (err) {
      toast({ title: "Could not remove photo", description: apiErrorMessage(err, "Unable to remove this photo."), variant: "destructive" });
    }
  }
  return <PhotoGallery attachments={existingPhotos.data ?? []} remaining={Math.max(0, 5 - (existingPhotos.data?.length ?? 0))} adding={addPhoto.isPending} onAdd={(files) => void uploadExisting(files)} onRemove={(attachment) => void deleteExisting(attachment.id)} />;
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
  const { role, user } = useRole();
  const users = useListUsers();
  const createUser = useCreateUser();
  const updateUserRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();
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
      toast({ title: "Could not update role", description: apiErrorMessage(err, "Unable to update this role."), variant: "destructive" });
    }
  }

  async function removeMember(member: User) {
    if (member.id === user?.id) {
      toast({ title: "You cannot delete your own account while signed in.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Remove ${member.name || member.email} from the team? Their login access is revoked in this app. Clerk is not changed.`)) return;
    try {
      await deleteUser.mutateAsync({ userId: member.id });
      await client.invalidateQueries();
      toast({ title: "Team member removed" });
    } catch (err) {
      toast({ title: "Could not remove member", description: apiErrorMessage(err, "Unable to remove this team member."), variant: "destructive" });
    }
  }

  const canRoles = canManageRoles(role);
  const canDelete = canDeleteTeamMembers(role);
  return <ShellPage>
    <Topbar title="Team" description="Manage who has access and what they can do." action={canOnboardUsers(role) ? <Button className="button-accent" onClick={() => setShowInvite(true)}><Plus size={16} /> Onboard user</Button> : undefined} />
    <div className="page-wrap">
      <Card className="table-card">
        {users.isLoading ? <LoadingBlock /> : users.isError ? <ErrorState onRetry={() => void users.refetch()} /> : users.data?.length ? (
          <div className="table-scroll"><table className="asset-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Onboarding</th><th>Last active</th><th /></tr></thead><tbody>
            {users.data.map((member) => {
              const pending = member.id.startsWith("pending:");
              return <tr key={member.id} data-testid={`row-user-${member.id}`}>
                <td><div className="asset-name"><span className="asset-glyph">{initials(member.name || member.email)}</span><span><b>{member.name || "—"}</b><small className="mono">{member.email}</small></span></div></td>
                <td>{canRoles && !pending ? <label className="field-select"><select data-testid={`select-role-${member.id}`} value={member.role} onChange={(event) => void changeRole(member, event.target.value)}>{ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select><ChevronDown size={14} /></label> : <StatusPill status={pending ? member.role : member.role} />}</td>
                <td>{pending ? <span className="status-pill status-orange"><i />Invited</span> : <span className="status-pill status-green"><i />Active</span>}</td>
                <td className="muted">{member.invitedBy ? "Onboarded" : "Self-registered"}</td>
                <td className="muted">{pending ? "—" : formatRelative(member.lastSeenAt)}</td>
                <td>{canDelete && member.id !== user?.id && <button className="row-arrow danger-action" aria-label={`Delete ${member.email}`} onClick={() => void removeMember(member)}><Trash2 size={14} /></button>}</td>
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
  const deleteReport = useDeleteComplianceReport();
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

  async function removeReport(report: ComplianceReport) {
    if (!window.confirm(`Delete “${report.title}”? This cannot be undone.`)) return;
    try {
      await deleteReport.mutateAsync({ reportId: report.id });
      await client.invalidateQueries();
      toast({ title: "Report deleted" });
    } catch (err) {
      toast({ title: "Could not delete report", description: apiErrorMessage(err, "Unable to delete this report."), variant: "destructive" });
    }
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
      <Card className="table-card" style={{ marginTop: 13, padding: 20 }}>
        <SectionHeading eyebrow="Compliance" title="Reports" detail="Draft, review, and finalize compliance reports." />
        {reports.isLoading ? <LoadingBlock /> : reports.isError ? <ErrorState onRetry={() => void reports.refetch()} /> : reports.data?.length ? (
          <div className="table-scroll"><table className="asset-table"><thead><tr><th>Report</th><th>Stage</th><th>Period</th><th>Updated</th><th /></tr></thead><tbody>
            {reports.data.map((report) => <tr key={report.id} data-testid={`row-report-${report.id}`} onClick={() => setLocation(`/reports/${report.id}`)}>
              <td><b>{report.title}</b></td>
              <td><span className={`status-pill ${REPORT_STAGE_TONE[report.status]}`}><i />{REPORT_STAGE_LABEL[report.status]}</span></td>
              <td className="muted">{report.periodStart ? `${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}` : "—"}</td>
              <td className="muted">{formatRelative(report.updatedAt)}</td>
              <td><div className="row-actions">{canDeleteReports(role) && <button className="row-arrow danger-action" aria-label={`Delete ${report.title}`} onClick={(event) => { event.stopPropagation(); void removeReport(report); }}><Trash2 size={14} /></button>}<button className="row-arrow" aria-label={`Open ${report.title}`} onClick={(event) => { event.stopPropagation(); setLocation(`/reports/${report.id}`); }}><ArrowRight size={16} /></button></div></td>
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
  const deleteReport = useDeleteComplianceReport();
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
      toast({ title: "Update failed", description: apiErrorMessage(err, "Unable to update this report."), variant: "destructive" });
    }
  }

  async function removeThisReport() {
    if (!window.confirm(`Delete “${data.title}”? This cannot be undone.`)) return;
    try {
      await deleteReport.mutateAsync({ reportId });
      toast({ title: "Report deleted" });
      setLocation("/reports");
    } catch (err) {
      toast({ title: "Could not delete report", description: apiErrorMessage(err, "Unable to delete this report."), variant: "destructive" });
    }
  }

  return <ShellPage>
    <Topbar title={data.title} description={`Compliance report · ${REPORT_STAGE_LABEL[data.status]}`} action={canDeleteReports(role) ? <Button className="button-ghost" onClick={() => void removeThisReport()}><Trash2 size={15} /> Delete</Button> : undefined} />
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
  return <div className="auth-landing noise"><header className="auth-landing-header"><Link href="/" className="brand"><span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.4} /></span><span className="brand-copy"><strong>asset<span>control</span></strong><small>OPERATIONS CONSOLE</small></span></Link><div className="auth-landing-actions"><Link href="/sign-in" className="button button-ghost">Sign in</Link><Link href="/sign-up" className="button button-accent">Create account</Link></div></header><main className="auth-landing-main"><div className="auth-kicker"><span className="health-dot" /> Asset operations, without the blind spots</div><h1>Know where every asset is. <em>Know what happens next.</em></h1><p>AssetControl gives growing operations teams one trusted register for inventory, people, locations, maintenance, and accountability.</p><div className="auth-landing-ctas"><Link href="/sign-up" className="button button-dark">Start your workspace <ArrowRight size={16} /></Link><Link href="/sign-in" className="text-link">Already have access? Sign in</Link></div><div className="auth-landing-proof"><span><Check size={15} /> Live asset register</span><span><Check size={15} /> Audit-ready activity</span><span><Check size={15} /> Maintenance visibility</span></div></main><div className="auth-landing-orbit orbit-one" /><div className="auth-landing-orbit orbit-two" /><AppFooter /></div>;
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