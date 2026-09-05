export const LOOKUP_GROUPS = [
  "inventory_category",
  "inventory_status",
  "maintenance_status",
  "maintenance_mode",
  "maintenance_scope",
  "maintenance_activity",
  "maintenance_priority",
] as const;

export type LookupGroup = (typeof LOOKUP_GROUPS)[number];

export type DefaultLookupOption = {
  id: string;
  group: LookupGroup;
  value: string;
  label: string;
  sortOrder: number;
  system: boolean;
};

export const DEFAULT_LOOKUP_OPTIONS: DefaultLookupOption[] = [
  { id: "lu-icat-laptop", group: "inventory_category", value: "Laptop", label: "Laptop", sortOrder: 10, system: true },
  { id: "lu-icat-monitor", group: "inventory_category", value: "Monitor", label: "Monitor", sortOrder: 20, system: true },
  { id: "lu-icat-server", group: "inventory_category", value: "Server", label: "Server", sortOrder: 30, system: true },
  { id: "lu-icat-peripheral", group: "inventory_category", value: "Peripheral", label: "Peripheral", sortOrder: 40, system: true },
  { id: "lu-icat-mobile", group: "inventory_category", value: "Mobile", label: "Mobile", sortOrder: 50, system: true },
  { id: "lu-icat-network", group: "inventory_category", value: "Networking", label: "Networking", sortOrder: 60, system: true },

  { id: "lu-ist-available", group: "inventory_status", value: "available", label: "Available", sortOrder: 10, system: true },
  { id: "lu-ist-assigned", group: "inventory_status", value: "assigned", label: "Assigned", sortOrder: 20, system: true },
  { id: "lu-ist-in_repair", group: "inventory_status", value: "in_repair", label: "In repair", sortOrder: 30, system: true },
  { id: "lu-ist-rma", group: "inventory_status", value: "rma", label: "RMA", sortOrder: 40, system: true },
  { id: "lu-ist-retired", group: "inventory_status", value: "retired", label: "Retired", sortOrder: 50, system: true },
  { id: "lu-ist-lost", group: "inventory_status", value: "lost", label: "Lost", sortOrder: 60, system: true },

  { id: "lu-mst-pending", group: "maintenance_status", value: "pending", label: "Pending", sortOrder: 10, system: true },
  { id: "lu-mst-scheduled", group: "maintenance_status", value: "scheduled", label: "Scheduled", sortOrder: 20, system: true },
  { id: "lu-mst-completed", group: "maintenance_status", value: "completed", label: "Completed", sortOrder: 30, system: true },
  { id: "lu-mst-overdue", group: "maintenance_status", value: "overdue", label: "Overdue", sortOrder: 40, system: true },

  { id: "lu-mmd-scheduled", group: "maintenance_mode", value: "scheduled", label: "Scheduled", sortOrder: 10, system: true },
  { id: "lu-mmd-emergency", group: "maintenance_mode", value: "emergency", label: "Emergency", sortOrder: 20, system: true },

  { id: "lu-msc-asset", group: "maintenance_scope", value: "asset", label: "Device", sortOrder: 10, system: true },
  { id: "lu-msc-estate", group: "maintenance_scope", value: "estate", label: "Preventive", sortOrder: 20, system: true },

  { id: "lu-mact-os_patch", group: "maintenance_activity", value: "os_patch", label: "OS patch", sortOrder: 10, system: true },
  { id: "lu-mact-app_patch", group: "maintenance_activity", value: "application_patch", label: "Application patch", sortOrder: 20, system: true },
  { id: "lu-mact-lan", group: "maintenance_activity", value: "lan", label: "LAN update", sortOrder: 30, system: true },
  { id: "lu-mact-firewall", group: "maintenance_activity", value: "firewall", label: "Firewall update", sortOrder: 40, system: true },
  { id: "lu-mact-other", group: "maintenance_activity", value: "other", label: "Other", sortOrder: 50, system: true },

  { id: "lu-mpr-high", group: "maintenance_priority", value: "high", label: "High", sortOrder: 10, system: true },
  { id: "lu-mpr-normal", group: "maintenance_priority", value: "normal", label: "Normal", sortOrder: 20, system: true },
  { id: "lu-mpr-low", group: "maintenance_priority", value: "low", label: "Low", sortOrder: 30, system: true },
];
