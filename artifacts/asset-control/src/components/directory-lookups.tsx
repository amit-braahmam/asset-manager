import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateLookup,
  useDeleteLookup,
  useListLookups,
  useUpdateLookup,
  type LookupOption,
} from "@workspace/api-client-react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Modal,
} from "@/components/asset-ui";
import { useToast } from "@/hooks/use-toast";
import { catalogRows } from "@/lib/lookup-options";

type LookupGroupId = LookupOption["group"];

type LookupModal = { group: LookupGroupId; title: string; option?: LookupOption } | null;

const INVENTORY_GROUPS: { group: LookupGroupId; title: string; hint: string }[] = [
  { group: "inventory_category", title: "Category", hint: "Rename updates assets that already use this category." },
  { group: "inventory_status", title: "Status", hint: "System statuses cannot be deleted. Dashboard still uses available, assigned, in repair, and RMA." },
];

const MAINTENANCE_GROUPS: { group: LookupGroupId; title: string; hint: string }[] = [
  { group: "maintenance_status", title: "Status", hint: "Completing work still uses the completed status." },
  { group: "maintenance_mode", title: "Mode", hint: "Scheduled and Emergency stay as system keys; labels can change." },
  { group: "maintenance_scope", title: "Scope", hint: "Device and Preventive only. Labels can change; values cannot." },
  { group: "maintenance_activity", title: "Activity", hint: "Used for preventive work. Other remains the fallback." },
  { group: "maintenance_priority", title: "Priority", hint: "High, Normal, and Low stay as system keys." },
];

function canAdd(group: LookupGroupId) {
  return group !== "maintenance_scope";
}

function persistedLookup(option: LookupOption) {
  return !option.id.startsWith("system-") && !option.id.startsWith("extra-");
}

function Heading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return err instanceof Error ? err.message : fallback;
}

function LookupGroupList({
  group,
  title,
  hint,
  options,
  canManage,
  canDelete,
  onAdd,
  onEdit,
  onDelete,
}: {
  group: LookupGroupId;
  title: string;
  hint: string;
  options: LookupOption[];
  canManage: boolean;
  canDelete: boolean;
  onAdd: () => void;
  onEdit: (option: LookupOption) => void;
  onDelete: (option: LookupOption) => void;
}) {
  return (
    <div className="lookup-group" data-testid={`lookup-group-${group}`}>
      <div className="lookup-group-head">
        <div>
          <b>{title}</b>
          <small>{hint}</small>
        </div>
        {canManage && canAdd(group) && (
          <button type="button" className="lookup-add" onClick={onAdd}>
            <Plus size={12} /> Add
          </button>
        )}
      </div>
      <div className="directory-list">
        {options.length ? options.map((option) => (
          <div className={`directory-row lookup-row${option.active ? "" : " lookup-inactive"}`} key={option.id}>
            <div>
              <b>{option.label}</b>
              <small>
                {option.system ? "System" : option.value}
                {option.usageCount ? ` · ${option.usageCount} in use` : ""}
                {option.active ? "" : " · Hidden"}
              </small>
            </div>
            {canManage && persistedLookup(option) && <button className="row-arrow" aria-label={`Edit ${option.label}`} onClick={() => onEdit(option)}><Pencil size={14} /></button>}
            {canDelete && persistedLookup(option) && !option.system && canAdd(group) && (
              <button className="row-arrow danger-action" aria-label={`Delete ${option.label}`} onClick={() => onDelete(option)}><Trash2 size={14} /></button>
            )}
          </div>
        )) : <EmptyState title={`No ${title.toLowerCase()} options`} text="Add an option to use it in forms and filters." />}
      </div>
    </div>
  );
}

function LookupForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: LookupOption;
  onSubmit: (values: { label: string; active: boolean }) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({ label, active });
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to save this option."));
    }
  }
  return (
    <form className="asset-form" onSubmit={submit}>
      <label className="field">
        <span>Label</span>
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Option label" required />
      </label>
      {initial && !initial.system && (
        <label className="lookup-active">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Show in dropdowns
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <Button type="button" className="button-ghost" onClick={onCancel}>Cancel</Button>
        <Button className="button-dark" disabled={submitting}>{submitting ? "Saving…" : "Save option"}</Button>
      </div>
    </form>
  );
}

export function DirectoryLookups({ canManage, canDelete }: { canManage: boolean; canDelete: boolean }) {
  const lookups = useListLookups();
  const createLookup = useCreateLookup();
  const updateLookup = useUpdateLookup();
  const deleteLookup = useDeleteLookup();
  const client = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<LookupModal>(null);

  function optionsFor(group: LookupGroupId) {
    return catalogRows(lookups.data, group);
  }

  async function saveOption(values: { label: string; active: boolean }) {
    if (!modal) return;
    if (modal.option) {
      await updateLookup.mutateAsync({
        lookupId: modal.option.id,
        data: { label: values.label, active: modal.option.system ? undefined : values.active },
      });
    } else {
      await createLookup.mutateAsync({ data: { group: modal.group, label: values.label } });
    }
    setModal(null);
    await client.invalidateQueries();
    toast({ title: modal.option ? "Option updated" : "Option added" });
  }

  async function removeOption(option: LookupOption) {
    if (!window.confirm(`Delete ${option.label}?`)) return;
    try {
      await deleteLookup.mutateAsync({ lookupId: option.id });
      await client.invalidateQueries();
      toast({ title: `${option.label} deleted` });
    } catch (err) {
      toast({ title: `Could not delete ${option.label}`, description: apiErrorMessage(err, "Unable to delete this option."), variant: "destructive" });
    }
  }

  return (
    <div className="lookup-grid">
      <Card>
        <Heading eyebrow="Dropdown options" title="Inventory options" detail="Category and status lists used when adding or filtering assets." />
        {lookups.isLoading ? <LoadingBlock /> : INVENTORY_GROUPS.map((item) => (
          <LookupGroupList
            key={item.group}
            {...item}
            options={optionsFor(item.group)}
            canManage={canManage}
            canDelete={canDelete}
            onAdd={() => setModal({ group: item.group, title: item.title })}
            onEdit={(option) => setModal({ group: item.group, title: item.title, option })}
            onDelete={(option) => void removeOption(option)}
          />
        ))}
      </Card>
      <Card>
        <Heading eyebrow="Dropdown options" title="Maintenance options" detail="Status, mode, scope, activity, and priority used on the maintenance queue." />
        {lookups.isLoading ? <LoadingBlock /> : MAINTENANCE_GROUPS.map((item) => (
          <LookupGroupList
            key={item.group}
            {...item}
            options={optionsFor(item.group)}
            canManage={canManage}
            canDelete={canDelete}
            onAdd={() => setModal({ group: item.group, title: item.title })}
            onEdit={(option) => setModal({ group: item.group, title: item.title, option })}
            onDelete={(option) => void removeOption(option)}
          />
        ))}
      </Card>
      {modal && (
        <Modal title={modal.option ? `Edit ${modal.title.toLowerCase()}` : `Add ${modal.title.toLowerCase()}`} onClose={() => setModal(null)}>
          <LookupForm
            initial={modal.option}
            onSubmit={saveOption}
            onCancel={() => setModal(null)}
            submitting={createLookup.isPending || updateLookup.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
