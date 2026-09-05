import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  listAssets,
  useBulkImportAssets,
  useBulkImportPeople,
  useListDepartments,
  useListLocations,
  useListLookups,
  useListPeople,
  type AssetInput,
  type PersonInput,
} from "@workspace/api-client-react";
import { FileUp, Download } from "lucide-react";
import { Button, Modal } from "@/components/asset-ui";
import { useToast } from "@/hooks/use-toast";
import { downloadCsv, parseSpreadsheet, type SpreadsheetTable } from "@/lib/import-file";
import {
  ASSET_FIELDS,
  PERSON_FIELDS,
  buildInventoryTemplateCsv,
  buildPeopleTemplateCsv,
  guessAssetMapping,
  guessPersonMapping,
  mappedAssetPayloads,
  mappedPersonPayloads,
  previewAssetRows,
  previewPersonRows,
  type AssetFieldKey,
  type ImportKind,
  type PersonFieldKey,
} from "@/lib/import-map";
import { lookupOptions } from "@/lib/lookup-options";

const IMPORT_BATCH_SIZE = 100;

function errorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return err instanceof Error ? err.message : fallback;
}

async function loadExistingAssetKeys() {
  const tags = new Set<string>();
  const serials = new Set<string>();
  let page = 1;
  let total = 1;
  while ((page - 1) * IMPORT_BATCH_SIZE < total) {
    const result = await listAssets({ page, pageSize: IMPORT_BATCH_SIZE });
    total = result.total;
    for (const item of result.items) {
      tags.add(item.assetTag.toLowerCase());
      serials.add(item.serialNumber.toLowerCase());
    }
    if (!result.items.length) break;
    page += 1;
  }
  return { tags, serials };
}

async function importInBatches<T>(
  items: T[],
  send: (chunk: T[]) => Promise<{ created: number; skipped: number }>,
) {
  let created = 0;
  let skipped = 0;
  for (let index = 0; index < items.length; index += IMPORT_BATCH_SIZE) {
    const result = await send(items.slice(index, index + IMPORT_BATCH_SIZE));
    created += result.created;
    skipped += result.skipped;
  }
  return { created, skipped };
}

export function DataImportModal({
  initialTab = "assets",
  onClose,
}: {
  initialTab?: ImportKind;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const { toast } = useToast();
  const locationsQuery = useListLocations();
  const peopleQuery = useListPeople();
  const departmentsQuery = useListDepartments();
  const lookupsQuery = useListLookups();
  const importAssets = useBulkImportAssets();
  const importPeople = useBulkImportPeople();
  const [tab, setTab] = useState<ImportKind>(initialTab);
  const [table, setTable] = useState<SpreadsheetTable | null>(null);
  const [assetMapping, setAssetMapping] = useState<Record<AssetFieldKey, string> | null>(null);
  const [personMapping, setPersonMapping] = useState<Record<PersonFieldKey, string> | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState("");
  const [assetKeys, setAssetKeys] = useState<{ tags: Set<string>; serials: Set<string> }>({
    tags: new Set(),
    serials: new Set(),
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const locations = locationsQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];

  useEffect(() => {
    if (!defaultLocationId && locations[0]) setDefaultLocationId(locations[0].id);
  }, [defaultLocationId, locations]);

  useEffect(() => {
    if (!table || tab !== "assets") return;
    let cancelled = false;
    void loadExistingAssetKeys()
      .then((keys) => {
        if (!cancelled) setAssetKeys(keys);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Unable to load existing inventory."));
      });
    return () => {
      cancelled = true;
    };
  }, [table, tab]);

  const assetPreview = useMemo(() => {
    if (!table || !assetMapping || tab !== "assets") return [];
    return previewAssetRows(table.rows, assetMapping, locations, assetKeys.tags, assetKeys.serials, defaultLocationId);
  }, [table, assetMapping, tab, locations, assetKeys, defaultLocationId]);

  const personPreview = useMemo(() => {
    if (!table || !personMapping || tab !== "people") return [];
    const emails = new Set((peopleQuery.data ?? []).map((person) => person.email));
    return previewPersonRows(table.rows, personMapping, departments, emails);
  }, [table, personMapping, tab, peopleQuery.data, departments]);

  const preview = tab === "assets" ? assetPreview : personPreview;
  const readyCount = preview.filter((row) => row.status === "ready").length;
  const skippedPreview = preview.filter((row) => row.status === "skipped");
  const mappingReady = tab === "assets"
    ? Boolean(assetMapping && ASSET_FIELDS.filter((field) => field.required).every((field) => assetMapping[field.key]))
    : Boolean(personMapping && PERSON_FIELDS.every((field) => personMapping[field.key]));

  function resetFile() {
    setTable(null);
    setAssetMapping(null);
    setPersonMapping(null);
    setError("");
  }

  function changeTab(next: ImportKind) {
    setTab(next);
    resetFile();
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const parsed = await parseSpreadsheet(file);
      setTable(parsed);
      if (tab === "assets") setAssetMapping(guessAssetMapping(parsed.headers));
      else setPersonMapping(guessPersonMapping(parsed.headers));
    } catch (err) {
      setTable(null);
      setError(errorMessage(err, "Unable to read this file."));
    }
  }

  async function submit() {
    if (!table || !mappingReady || readyCount === 0) return;
    if (tab === "assets" && !locations.length) {
      setError("Add a location in Directory before importing inventory.");
      return;
    }
    if (tab === "people" && !departments.length) {
      setError("Add a department in Directory before importing people.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const readyRows = new Set(preview.filter((row) => row.status === "ready").map((row) => row.row));
      const result = tab === "assets"
        ? await importInBatches(
          mappedAssetPayloads(
            table.rows,
            assetMapping!,
            locations,
            defaultLocationId,
            readyRows,
            lookupOptions(lookupsQuery.data, "inventory_status"),
          ) as AssetInput[],
          (items) => importAssets.mutateAsync({ data: { items } }),
        )
        : await importInBatches(
          mappedPersonPayloads(table.rows, personMapping!, departments, readyRows) as PersonInput[],
          (items) => importPeople.mutateAsync({ data: { items } }),
        );
      await client.invalidateQueries();
      toast({
        title: `${result.created} ${tab === "assets" ? "assets" : "people"} imported`,
        description: skippedPreview.length || result.skipped
          ? `${skippedPreview.length + result.skipped} rows skipped.`
          : undefined,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Unable to import these rows."));
    } finally {
      setSubmitting(false);
    }
  }

  const emptyHint = tab === "assets"
    ? "Asset tag, name, manufacturer, model, and serial number must be mapped. Description never becomes the asset name."
    : "Name, email, and department must be mapped. Department names must already exist in Directory.";

  function downloadTemplate() {
    if (tab === "assets") {
      downloadCsv("asset-manager-inventory-template.csv", buildInventoryTemplateCsv(locations[0]?.name ?? ""));
      return;
    }
    downloadCsv("asset-manager-people-template.csv", buildPeopleTemplateCsv(departments[0]?.name ?? ""));
  }

  return (
    <Modal title="Data import" onClose={onClose} className="import-modal">
      <div className="import-wizard">
        <div className="import-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "assets"} className={tab === "assets" ? "active" : ""} onClick={() => changeTab("assets")}>Inventory</button>
          <button type="button" role="tab" aria-selected={tab === "people"} className={tab === "people" ? "active" : ""} onClick={() => changeTab("people")}>People</button>
        </div>
        <p className="modal-intro">{emptyHint} Nothing is written until you submit.</p>
        <div className="import-template">
          <button type="button" className="text-button" onClick={downloadTemplate}>
            <Download size={14} /> Download {tab === "assets" ? "inventory" : "people"} CSV template
          </button>
          <small>
            {tab === "assets"
              ? "Add your rows, then upload. Replace the sample row. Location names must match Directory."
              : "Add your rows, then upload. Replace the sample row. Department must already exist in Directory."}
          </small>
        </div>
        {!table ? (
          <label className="import-drop">
            <FileUp size={18} />
            <b>Drop a CSV or Excel file, or browse</b>
            <small>.csv, .xlsx, or .xls · first sheet · up to 2,000 rows and 5 MB</small>
            <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void onFile(event)} />
          </label>
        ) : (
          <>
            <div className="import-file-meta">
              <span><b>{table.fileName}</b> · {table.rows.length} rows</span>
              <button type="button" className="text-button" onClick={resetFile}>Choose another file</button>
            </div>
            {table.truncated && <p className="form-error">Only the first 2,000 rows will be imported.</p>}
            <div className="import-map-wrap">
              <table className="import-map">
                <thead><tr><th>Asset Manager field</th><th>Column in file</th></tr></thead>
                <tbody>
                  {tab === "assets" && assetMapping && ASSET_FIELDS.map((field) => (
                    <tr key={field.key}>
                      <td>{field.label}{field.required ? " *" : ""}</td>
                      <td>
                        <select
                          value={assetMapping[field.key]}
                          onChange={(event) => {
                            const value = event.target.value;
                            setAssetMapping((current) => current ? { ...current, [field.key]: value } : current);
                          }}
                        >
                          <option value="">Ignore</option>
                          {table.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {tab === "people" && personMapping && PERSON_FIELDS.map((field) => (
                    <tr key={field.key}>
                      <td>{field.label}{field.required ? " *" : ""}</td>
                      <td>
                        <select
                          value={personMapping[field.key]}
                          onChange={(event) => {
                            const value = event.target.value;
                            setPersonMapping((current) => current ? { ...current, [field.key]: value } : current);
                          }}
                        >
                          <option value="">Ignore</option>
                          {table.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tab === "assets" && (
              <label className="field">
                <span>Default location for unmatched names</span>
                <select value={defaultLocationId} onChange={(event) => setDefaultLocationId(event.target.value)}>
                  <option value="">Select a location</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </label>
            )}
            <div className="import-preview">
              <div className="import-counts">
                <span><b>{readyCount}</b> ready</span>
                <span><b>{skippedPreview.length}</b> skipped</span>
              </div>
              <div className="import-preview-list">
                {skippedPreview.slice(0, 40).map((row) => (
                  <div className="import-skip" key={`skip-${row.row}`}><span>Row {row.row}</span><b>{row.summary}</b><small>{row.reason}</small></div>
                ))}
                {skippedPreview.length > 40 && <p className="muted">Showing the first 40 skipped rows.</p>}
                {!skippedPreview.length && readyCount > 0 && preview.filter((row) => row.status === "ready").slice(0, 8).map((row) => (
                  <div className="import-ready" key={`ready-${row.row}`}><span>Row {row.row}</span><b>{row.summary}</b></div>
                ))}
              </div>
            </div>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            className="button-dark"
            disabled={!table || !mappingReady || readyCount === 0 || submitting}
            onClick={() => void submit()}
          >
            {submitting ? "Importing…" : `Import ${readyCount} ready ${tab === "assets" ? "assets" : "people"}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
